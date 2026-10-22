#!/usr/bin/env bash
# Phase 2 deployment: custom shelves, shelf visibility, book stats.
#
#   ./backend/scripts/deploy-phase2.sh
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

log "Shelves table"
if ! aws_ dynamodb describe-table --table-name pagebound-shelves >/dev/null 2>&1; then
  aws_ dynamodb create-table --cli-input-json "file://$HERE/../create-shelves-table.json" >/dev/null
  echo "   creating pagebound-shelves"
fi
aws_ dynamodb wait table-exists --table-name pagebound-shelves
echo "   ready"

log "isbn-index on pagebound-library (for book stats)"
has_index=$(aws_ dynamodb describe-table --table-name pagebound-library \
  --query "Table.GlobalSecondaryIndexes[?IndexName=='isbn-index'] | length(@)" --output text | tr -d '\r')
if [ "$has_index" = "0" ]; then
  aws_ dynamodb update-table --table-name pagebound-library \
    --attribute-definitions AttributeName=isbn,AttributeType=S \
    --global-secondary-index-updates '[{"Create":{"IndexName":"isbn-index","KeySchema":[{"AttributeName":"isbn","KeyType":"HASH"}],"Projection":{"ProjectionType":"INCLUDE","NonKeyAttributes":["rating","shelf"]}}}]' >/dev/null
  echo "   creating index"
fi
for i in $(seq 1 60); do
  status=$(aws_ dynamodb describe-table --table-name pagebound-library \
    --query "Table.GlobalSecondaryIndexes[?IndexName=='isbn-index'].IndexStatus | [0]" --output text | tr -d '\r')
  [ "$status" = "ACTIVE" ] && break
  sleep 10
done
echo "   index $status"

log "Library Lambda"
rm -rf "$BUILD_DIR/pkg" && mkdir -p "$BUILD_DIR/pkg"
cp "$LAMBDA_DIR/libraryAPI.js" "$BUILD_DIR/pkg/index.js"
(cd "$BUILD_DIR/pkg" && python -c "import zipfile; z=zipfile.ZipFile('../library.zip','w',zipfile.ZIP_DEFLATED); z.write('index.js'); z.close()")
aws_ lambda update-function-code --function-name pagebound-library-api --zip-file "fileb://$BUILD_DIR/library.zip" >/dev/null
aws_ lambda wait function-updated --function-name pagebound-library-api
aws_ lambda update-function-configuration --function-name pagebound-library-api \
  --environment "Variables={LIBRARY_TABLE=pagebound-library,SHELVES_TABLE=pagebound-shelves,SESSIONS_TABLE=pagebound-sessions}" >/dev/null
aws_ lambda wait function-updated --function-name pagebound-library-api
if ! aws_ lambda get-policy --function-name pagebound-library-api --query Policy --output text | grep -q apigateway-books; then
  aws_ lambda add-permission --function-name pagebound-library-api --statement-id apigateway-books \
    --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*/books/*" >/dev/null
fi
echo "   updated"

log "Routes"
shelves=$(ensure_resource '/library/{userId}' shelves)
shelf=$(ensure_resource '/library/{userId}/shelves' '{shelfId}')
books=$(ensure_resource / books)
isbn=$(ensure_resource /books '{isbn}')
stats=$(ensure_resource '/books/{isbn}' stats)
ensure_lambda_method "$shelves" GET pagebound-library-api
ensure_lambda_method "$shelves" POST pagebound-library-api
ensure_lambda_method "$shelf" PUT pagebound-library-api
ensure_lambda_method "$shelf" DELETE pagebound-library-api
ensure_lambda_method "$stats" GET pagebound-library-api
for rid in "$shelves" "$shelf" "$books" "$isbn" "$stats"; do ensure_options "$rid"; done

log "Require sign-in on every non-OPTIONS method"
MSYS_NO_PATHCONV=1 python "$HERE/require_auth.py"

log "Publish"
aws_ apigateway create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE" \
  --description "Phase 2: shelves, book stats" --query id --output text

rm -rf "$BUILD_DIR"
