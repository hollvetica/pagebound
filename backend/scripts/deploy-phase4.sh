#!/usr/bin/env bash
# Phase 4 deployment: activity feed, reactions, recommendations, friends' shelves.
#
#   ./backend/scripts/deploy-phase4.sh
#
# Additive and backward compatible – safe to run while the current frontend
# is live; push the new frontend afterwards. Idempotent.
set -euo pipefail

REGION=us-east-2
ACCOUNT=462233538835
API_ID=ylpqf7y8ed
STAGE=prod

# The AWS CLI on Windows needs Windows paths (C:/...), not Git Bash ones (/c/...)
winpath() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
HERE="$(winpath "$(cd "$(dirname "$0")" && pwd)")"
LAMBDA_DIR="$HERE/../lambda"
BUILD_DIR="$(winpath "$(mktemp -d)")"

aws_() { MSYS_NO_PATHCONV=1 aws --region "$REGION" "$@" < /dev/null; }
log() { printf '\n== %s\n' "$*"; }

resource_id() {
  aws_ apigateway get-resources --rest-api-id "$API_ID" --limit 500 \
    --query "items[?path=='$1'].id | [0]" --output text | tr -d '\r' | grep -v None || true
}

ensure_resource() { # <parent path> <part> -> id
  local parent="$1" part="$2" path id
  path="${parent%/}/$part"
  id="$(resource_id "$path")"
  if [ -z "$id" ]; then
    id=$(aws_ apigateway create-resource --rest-api-id "$API_ID" \
      --parent-id "$(resource_id "$parent")" --path-part "$part" --query id --output text | tr -d '\r')
    echo "   created resource $path" >&2
  fi
  echo "$id"
}

ensure_options() {
  local rid="$1"
  if aws_ apigateway get-method --rest-api-id "$API_ID" --resource-id "$rid" --http-method OPTIONS >/dev/null 2>&1; then return; fi
  aws_ apigateway put-method --rest-api-id "$API_ID" --resource-id "$rid" --http-method OPTIONS --authorization-type NONE >/dev/null
  aws_ apigateway put-integration --rest-api-id "$API_ID" --resource-id "$rid" --http-method OPTIONS \
    --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}' >/dev/null
  aws_ apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$rid" --http-method OPTIONS \
    --status-code 200 --response-parameters \
    'method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false' >/dev/null
  aws_ apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$rid" --http-method OPTIONS \
    --status-code 200 --response-parameters \
    "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,POST,PUT,DELETE,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" >/dev/null
  echo "   added OPTIONS on $rid"
}

ensure_lambda_method() { # <resource id> <METHOD> <function name>
  local rid="$1" method="$2" fn="$3"
  local fn_arn="arn:aws:lambda:${REGION}:${ACCOUNT}:function:${fn}"
  if ! aws_ apigateway get-method --rest-api-id "$API_ID" --resource-id "$rid" --http-method "$method" >/dev/null 2>&1; then
    # New methods start protected; require_auth.py below re-checks every method
    aws_ apigateway put-method --rest-api-id "$API_ID" --resource-id "$rid" --http-method "$method" \
      --authorization-type NONE >/dev/null
    aws_ apigateway put-integration --rest-api-id "$API_ID" --resource-id "$rid" --http-method "$method" \
      --type AWS_PROXY --integration-http-method POST \
      --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${fn_arn}/invocations" >/dev/null
    echo "   added $method on $rid -> $fn"
  fi
}

ROLE_ARN=arn:aws:iam::${ACCOUNT}:role/pagebound-auth-LambdaExecutionRole-KPBhqCAy0Cnh

zip_lambda() { # <source .js> <name> -> zip path
  rm -rf "$BUILD_DIR/pkg" && mkdir -p "$BUILD_DIR/pkg"
  cp "$LAMBDA_DIR/$1" "$BUILD_DIR/pkg/index.js"
  (cd "$BUILD_DIR/pkg" && python -c "import zipfile; z=zipfile.ZipFile('../$2.zip','w',zipfile.ZIP_DEFLATED); z.write('index.js'); z.close()")
  echo "$BUILD_DIR/$2.zip"
}

ensure_permission() { # <function> <statement id> <source path pattern>
  if ! aws_ lambda get-policy --function-name "$1" --query Policy --output text 2>/dev/null | grep -q "$2"; then
    aws_ lambda add-permission --function-name "$1" --statement-id "$2" \
      --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*/$3" >/dev/null
  fi
}

log "Tables"
for t in activity recommendations reactions; do
  if ! aws_ dynamodb describe-table --table-name "pagebound-$t" >/dev/null 2>&1; then
    aws_ dynamodb create-table --cli-input-json "file://$HERE/../create-$t-table.json" >/dev/null
    echo "   creating pagebound-$t"
  fi
done
for t in activity recommendations reactions; do aws_ dynamodb wait table-exists --table-name "pagebound-$t"; done
echo "   ready"

log "Social Lambda"
SOCIAL_ENV="Variables={ACTIVITY_TABLE=pagebound-activity,RECOMMENDATIONS_TABLE=pagebound-recommendations,REACTIONS_TABLE=pagebound-reactions,FRIENDS_TABLE=pagebound-friends,SHELVES_TABLE=pagebound-shelves,USERS_TABLE=pagebound-users}"
zip=$(zip_lambda socialAPI.js social)
if aws_ lambda get-function --function-name pagebound-social-api >/dev/null 2>&1; then
  aws_ lambda update-function-code --function-name pagebound-social-api --zip-file "fileb://$zip" >/dev/null
  aws_ lambda wait function-updated --function-name pagebound-social-api
  aws_ lambda update-function-configuration --function-name pagebound-social-api --environment "$SOCIAL_ENV" >/dev/null
else
  aws_ lambda create-function --function-name pagebound-social-api --runtime nodejs20.x \
    --handler index.handler --role "$ROLE_ARN" --zip-file "fileb://$zip" --timeout 15 --memory-size 256 \
    --environment "$SOCIAL_ENV" >/dev/null
fi
aws_ lambda wait function-active --function-name pagebound-social-api
aws_ lambda wait function-updated --function-name pagebound-social-api
ensure_permission pagebound-social-api apigateway-feed 'feed'
ensure_permission pagebound-social-api apigateway-feed-items 'feed/*'
ensure_permission pagebound-social-api apigateway-recommendations 'recommendations'
echo "   pagebound-social-api ready"

log "Library and sessions Lambdas (record activity; friends' shelves)"
aws_ lambda update-function-code --function-name pagebound-library-api --zip-file "fileb://$(zip_lambda libraryAPI.js library)" >/dev/null
aws_ lambda wait function-updated --function-name pagebound-library-api
aws_ lambda update-function-configuration --function-name pagebound-library-api \
  --environment "Variables={LIBRARY_TABLE=pagebound-library,SHELVES_TABLE=pagebound-shelves,SESSIONS_TABLE=pagebound-sessions,ACTIVITY_TABLE=pagebound-activity,FRIENDS_TABLE=pagebound-friends,USERS_TABLE=pagebound-users}" >/dev/null
aws_ lambda update-function-code --function-name pagebound-sessions-api --zip-file "fileb://$(zip_lambda sessionsAPI.js sessions)" >/dev/null
aws_ lambda wait function-updated --function-name pagebound-sessions-api
aws_ lambda update-function-configuration --function-name pagebound-sessions-api \
  --environment "Variables={SESSIONS_TABLE=pagebound-sessions,MEMBERS_TABLE=pagebound-session-members,MESSAGES_TABLE=pagebound-messages,USERS_TABLE=pagebound-users,FRIENDS_TABLE=pagebound-friends,ACTIVITY_TABLE=pagebound-activity}" >/dev/null
aws_ lambda wait function-updated --function-name pagebound-library-api
aws_ lambda wait function-updated --function-name pagebound-sessions-api
echo "   updated"

log "Routes"
feed=$(ensure_resource / feed)
items=$(ensure_resource /feed items)
item=$(ensure_resource /feed/items '{itemId}')
reactions=$(ensure_resource '/feed/items/{itemId}' reactions)
recs=$(ensure_resource / recommendations)
public=$(ensure_resource '/library/{userId}' public)
ensure_lambda_method "$feed" GET pagebound-social-api
ensure_lambda_method "$reactions" PUT pagebound-social-api
ensure_lambda_method "$recs" POST pagebound-social-api
ensure_lambda_method "$public" GET pagebound-library-api
for rid in "$feed" "$items" "$item" "$reactions" "$recs" "$public"; do ensure_options "$rid"; done

log "Require sign-in on every non-OPTIONS method"
MSYS_NO_PATHCONV=1 python "$HERE/require_auth.py"

log "Publish"
aws_ apigateway create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE" \
  --description "Phase 4: feed, reactions, recommendations, friends' shelves" --query id --output text

rm -rf "$BUILD_DIR"
