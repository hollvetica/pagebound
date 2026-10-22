#!/usr/bin/env bash
# Phase 3 deployment: session notifications, inviting friends, leaving.
#
#   ./backend/scripts/deploy-phase3.sh
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

log "Sessions Lambda"
rm -rf "$BUILD_DIR/pkg" && mkdir -p "$BUILD_DIR/pkg"
cp "$LAMBDA_DIR/sessionsAPI.js" "$BUILD_DIR/pkg/index.js"
(cd "$BUILD_DIR/pkg" && python -c "import zipfile; z=zipfile.ZipFile('../sessions.zip','w',zipfile.ZIP_DEFLATED); z.write('index.js'); z.close()")
aws_ lambda update-function-code --function-name pagebound-sessions-api --zip-file "fileb://$BUILD_DIR/sessions.zip" >/dev/null
aws_ lambda wait function-updated --function-name pagebound-sessions-api
# One permission for every /sessions route (the originals were per-route)
if ! aws_ lambda get-policy --function-name pagebound-sessions-api --query Policy --output text | grep -q apigateway-sessions-all; then
  aws_ lambda add-permission --function-name pagebound-sessions-api --statement-id apigateway-sessions-all     --action lambda:InvokeFunction --principal apigateway.amazonaws.com     --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*/sessions/*" >/dev/null
fi
echo "   updated"

log "Routes"
seen=$(ensure_resource '/sessions/{sessionId}' seen)
participants=$(ensure_resource '/sessions/{sessionId}' participants)
participant=$(ensure_resource '/sessions/{sessionId}/participants' '{userId}')
ensure_lambda_method "$seen" PUT pagebound-sessions-api
ensure_lambda_method "$participants" POST pagebound-sessions-api
ensure_lambda_method "$participant" DELETE pagebound-sessions-api
for rid in "$seen" "$participants" "$participant"; do ensure_options "$rid"; done

log "Require sign-in on every non-OPTIONS method"
MSYS_NO_PATHCONV=1 python "$HERE/require_auth.py"

log "Publish"
aws_ apigateway create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE"   --description "Phase 3: notifications, invites, leave" --query id --output text

rm -rf "$BUILD_DIR"
