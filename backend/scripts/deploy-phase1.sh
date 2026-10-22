#!/usr/bin/env bash
# Phase 1 deployment: secure the API, library backend, shared sessions.
#
#   ./backend/scripts/deploy-phase1.sh prepare   # safe while the old app is live
#   (push the new frontend and wait until it is live)
#   ./backend/scripts/deploy-phase1.sh secure    # switch on auth + new Lambda code
#
# Every step is idempotent: re-running skips what already exists.
set -euo pipefail

REGION=us-east-2
ACCOUNT=462233538835
API_ID=ylpqf7y8ed
STAGE=prod
USER_POOL_ID=us-east-2_qPCehehzb
ROLE_ARN=arn:aws:iam::${ACCOUNT}:role/pagebound-auth-LambdaExecutionRole-KPBhqCAy0Cnh
AUTHORIZER_NAME=pagebound-cognito
# The AWS CLI on Windows needs Windows paths (C:/...), not Git Bash ones (/c/...)
winpath() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
HERE="$(winpath "$(cd "$(dirname "$0")" && pwd)")"
LAMBDA_DIR="$HERE/../lambda"
BUILD_DIR="$(winpath "$(mktemp -d)")"

aws_() { MSYS_NO_PATHCONV=1 aws --region "$REGION" "$@"; }
log() { printf '\n== %s\n' "$*"; }

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
zip_lambda() { # <source file> -> zip path (as index.js)
  local src="$1" out="$BUILD_DIR/$(basename "$1" .js).zip"
  rm -rf "$BUILD_DIR/pkg" && mkdir -p "$BUILD_DIR/pkg"
  cp "$src" "$BUILD_DIR/pkg/index.js"
  (cd "$BUILD_DIR/pkg" && python -c "import zipfile; z=zipfile.ZipFile('../$(basename "$out")','w',zipfile.ZIP_DEFLATED); z.write('index.js'); z.close()")
  echo "$out"
}

resource_id() { # <path> -> id or empty
  aws_ apigateway get-resources --rest-api-id "$API_ID" --limit 500 \
    --query "items[?path=='$1'].id | [0]" --output text | grep -v None || true
}

ensure_resource() { # <parent path> <part> -> id
  local parent="$1" part="$2" path
  path="${parent%/}/$part"
  local id; id="$(resource_id "$path")"
  if [ -z "$id" ]; then
    id=$(aws_ apigateway create-resource --rest-api-id "$API_ID" \
      --parent-id "$(resource_id "$parent")" --path-part "$part" --query id --output text)
    echo "   created resource $path" >&2
  fi
  echo "$id"
}

ensure_options() { # <resource id> – CORS preflight (MOCK)
  local rid="$1"
  if aws_ apigateway get-method --rest-api-id "$API_ID" --resource-id "$rid" --http-method OPTIONS >/dev/null 2>&1; then return; fi
  aws_ apigateway put-method --rest-api-id "$API_ID" --resource-id "$rid" --http-method OPTIONS \
    --authorization-type NONE >/dev/null
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
    aws_ apigateway put-method --rest-api-id "$API_ID" --resource-id "$rid" --http-method "$method" \
      --authorization-type NONE --request-parameters '{}' >/dev/null
    aws_ apigateway put-integration --rest-api-id "$API_ID" --resource-id "$rid" --http-method "$method" \
      --type AWS_PROXY --integration-http-method POST \
      --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${fn_arn}/invocations" >/dev/null
    echo "   added $method on $rid -> $fn"
  fi
}

deploy_stage() {
  aws_ apigateway create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE" \
    --description "$1" --query id --output text
}

# ---------------------------------------------------------------------------
# prepare: everything that is safe while the current frontend is live
# ---------------------------------------------------------------------------
prepare() {
  log "Tables"
  if ! aws_ dynamodb describe-table --table-name pagebound-library >/dev/null 2>&1; then
    aws_ dynamodb create-table --cli-input-json "file://$HERE/../create-library-table.json" >/dev/null
    echo "   creating pagebound-library"
  fi
  if ! aws_ dynamodb describe-table --table-name pagebound-session-members >/dev/null 2>&1; then
    aws_ dynamodb create-table --cli-input-json "file://$HERE/../create-session-members-table.json" >/dev/null
    echo "   creating pagebound-session-members"
  fi
  aws_ dynamodb wait table-exists --table-name pagebound-library
  aws_ dynamodb wait table-exists --table-name pagebound-session-members
  echo "   tables ready"

  log "Backfill userId for users created before it existed"
  for email in $(aws_ dynamodb scan --table-name pagebound-users \
      --filter-expression "attribute_not_exists(userId)" --projection-expression email \
      --query "Items[].email.S" --output text); do
    sub=$(aws_ cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username "$email" \
      --query "UserAttributes[?Name=='sub'].Value | [0]" --output text)
    aws_ dynamodb update-item --table-name pagebound-users --key "{\"email\":{\"S\":\"$email\"}}" \
      --update-expression "SET userId = :u" --expression-attribute-values "{\":u\":{\"S\":\"$sub\"}}"
    echo "   backfilled one user"
  done

  log "Library Lambda"
  local zip; zip=$(zip_lambda "$LAMBDA_DIR/libraryAPI.js")
  if aws_ lambda get-function --function-name pagebound-library-api >/dev/null 2>&1; then
    aws_ lambda update-function-code --function-name pagebound-library-api --zip-file "fileb://$zip" >/dev/null
  else
    aws_ lambda create-function --function-name pagebound-library-api --runtime nodejs20.x \
      --handler index.handler --role "$ROLE_ARN" --zip-file "fileb://$zip" --timeout 15 --memory-size 256 \
      --environment "Variables={LIBRARY_TABLE=pagebound-library}" >/dev/null
    aws_ lambda wait function-active --function-name pagebound-library-api
    aws_ lambda add-permission --function-name pagebound-library-api --statement-id apigateway-library \
      --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*/library/*" >/dev/null
  fi
  echo "   pagebound-library-api ready"

  log "Library routes"
  local lib uid books isbn stats
  lib=$(ensure_resource / library)
  uid=$(ensure_resource /library '{userId}')
  books=$(ensure_resource '/library/{userId}' books)
  isbn=$(ensure_resource '/library/{userId}/books' '{isbn}')
  stats=$(ensure_resource '/library/{userId}' stats)
  ensure_lambda_method "$books" GET pagebound-library-api
  ensure_lambda_method "$books" POST pagebound-library-api
  ensure_lambda_method "$isbn" PUT pagebound-library-api
  ensure_lambda_method "$isbn" DELETE pagebound-library-api
  ensure_lambda_method "$stats" GET pagebound-library-api

  log "CORS preflight on every resource with methods"
  for rid in $(aws_ apigateway get-resources --rest-api-id "$API_ID" --limit 500 --embed methods \
      --query "items[?resourceMethods].id" --output text); do
    ensure_options "$rid"
  done
  for rid in "$lib" "$uid"; do ensure_options "$rid"; done

  log "CORS on gateway error responses (so 401/403 reach the app)"
  for type in DEFAULT_4XX DEFAULT_5XX; do
    aws_ apigateway put-gateway-response --rest-api-id "$API_ID" --response-type "$type" \
      --response-parameters "{\"gatewayresponse.header.Access-Control-Allow-Origin\":\"'*'\",\"gatewayresponse.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization'\"}" >/dev/null
  done
  echo "   done"

  log "Publish (no auth yet)"
  deploy_stage "Phase 1 prepare: library routes, CORS"
}

# ---------------------------------------------------------------------------
# secure: run right after the new frontend is live
# ---------------------------------------------------------------------------
secure() {
  log "Cognito authorizer"
  local auth_id
  auth_id=$(aws_ apigateway get-authorizers --rest-api-id "$API_ID" \
    --query "items[?name=='$AUTHORIZER_NAME'].id | [0]" --output text | grep -v None || true)
  if [ -z "$auth_id" ]; then
    auth_id=$(aws_ apigateway create-authorizer --rest-api-id "$API_ID" --name "$AUTHORIZER_NAME" \
      --type COGNITO_USER_POOLS --identity-source method.request.header.Authorization \
      --provider-arns "arn:aws:cognito-idp:${REGION}:${ACCOUNT}:userpool/${USER_POOL_ID}" --query id --output text)
  fi
  echo "   authorizer $auth_id"

  log "Lambda code (requires the authorizer's claims)"
  aws_ lambda update-function-code --function-name pagebound-friends-api --zip-file "fileb://$(zip_lambda "$LAMBDA_DIR/friendsAPI.js")" >/dev/null
  aws_ lambda update-function-code --function-name pagebound-user-api --zip-file "fileb://$(zip_lambda "$LAMBDA_DIR/userAPI.live.js")" >/dev/null
  aws_ lambda update-function-code --function-name pagebound-sessions-api --zip-file "fileb://$(zip_lambda "$LAMBDA_DIR/sessionsAPI.js")" >/dev/null
  aws_ lambda wait function-updated --function-name pagebound-sessions-api
  aws_ lambda update-function-configuration --function-name pagebound-sessions-api \
    --runtime nodejs20.x --role "$ROLE_ARN" --timeout 15 \
    --environment "Variables={SESSIONS_TABLE=pagebound-sessions,MEMBERS_TABLE=pagebound-session-members,MESSAGES_TABLE=pagebound-messages,USERS_TABLE=pagebound-users,FRIENDS_TABLE=pagebound-friends}" >/dev/null
  for fn in pagebound-friends-api pagebound-user-api pagebound-sessions-api; do
    aws_ lambda wait function-updated --function-name "$fn"
  done
  echo "   friends, user, sessions updated"

  log "Require sign-in on every non-OPTIONS method"
  # Python + JSON output: the shell loop broke on Windows line endings and
  # on the AWS CLI reading the loop's stdin
  MSYS_NO_PATHCONV=1 python "$HERE/require_auth.py"

  log "Publish"
  deploy_stage "Phase 1 secure: Cognito auth on all routes"
}

case "${1:-}" in
  prepare) prepare ;;
  secure) secure ;;
  *) echo "usage: $0 prepare|secure" >&2; exit 1 ;;
esac
rm -rf "$BUILD_DIR"
