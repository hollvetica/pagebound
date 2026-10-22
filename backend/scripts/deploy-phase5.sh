#!/usr/bin/env bash
# Phase 5 deployment: reviews, profile editing, stats, avatar uploads.
#
#   ./backend/scripts/deploy-phase5.sh
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

AVATAR_BUCKET=pagebound-avatars-${ACCOUNT}
ROLE_NAME=pagebound-auth-LambdaExecutionRole-KPBhqCAy0Cnh

log "Reviews table"
if ! aws_ dynamodb describe-table --table-name pagebound-reviews >/dev/null 2>&1; then
  aws_ dynamodb create-table --cli-input-json "file://$HERE/../create-reviews-table.json" >/dev/null
  echo "   creating pagebound-reviews"
fi
aws_ dynamodb wait table-exists --table-name pagebound-reviews
echo "   ready"

log "Avatar bucket (public read for avatars/* only)"
if ! aws_ s3api head-bucket --bucket "$AVATAR_BUCKET" >/dev/null 2>&1; then
  aws_ s3api create-bucket --bucket "$AVATAR_BUCKET" \
    --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  echo "   created $AVATAR_BUCKET"
fi
# ACLs stay blocked; only the bucket policy below grants public reads
aws_ s3api put-public-access-block --bucket "$AVATAR_BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws_ s3api put-bucket-policy --bucket "$AVATAR_BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"PublicReadAvatars\",\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::${AVATAR_BUCKET}/avatars/*\"}]}"
echo "   policy set"

log "Let the Lambda role write avatars"
aws_ iam put-role-policy --role-name "$ROLE_NAME" --policy-name AvatarUploads --policy-document \
  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:DeleteObject\"],\"Resource\":\"arn:aws:s3:::${AVATAR_BUCKET}/avatars/*\"}]}"
echo "   done"

log "Lambdas"
aws_ lambda update-function-code --function-name pagebound-user-api --zip-file "fileb://$(zip_lambda userAPI.live.js user)" >/dev/null
aws_ lambda update-function-code --function-name pagebound-social-api --zip-file "fileb://$(zip_lambda socialAPI.js social)" >/dev/null
aws_ lambda update-function-code --function-name pagebound-library-api --zip-file "fileb://$(zip_lambda libraryAPI.js library)" >/dev/null
for fn in pagebound-user-api pagebound-social-api pagebound-library-api; do aws_ lambda wait function-updated --function-name "$fn"; done
aws_ lambda update-function-configuration --function-name pagebound-user-api --timeout 15 \
  --environment "Variables={USERS_TABLE=pagebound-users,USER_POOL_ID=us-east-2_qPCehehzb,LIBRARY_TABLE=pagebound-library,FRIENDS_TABLE=pagebound-friends,AVATAR_BUCKET=${AVATAR_BUCKET}}" >/dev/null
aws_ lambda update-function-configuration --function-name pagebound-social-api \
  --environment "Variables={ACTIVITY_TABLE=pagebound-activity,RECOMMENDATIONS_TABLE=pagebound-recommendations,REACTIONS_TABLE=pagebound-reactions,FRIENDS_TABLE=pagebound-friends,SHELVES_TABLE=pagebound-shelves,USERS_TABLE=pagebound-users,REVIEWS_TABLE=pagebound-reviews,LIBRARY_TABLE=pagebound-library}" >/dev/null
for fn in pagebound-user-api pagebound-social-api; do aws_ lambda wait function-updated --function-name "$fn"; done
ensure_permission pagebound-social-api apigateway-book-reviews 'books/*'
ensure_permission pagebound-social-api apigateway-reviews-by 'reviews/*'
echo "   updated"

log "Routes"
reviews=$(ensure_resource '/books/{isbn}' reviews)
mine=$(ensure_resource '/books/{isbn}/reviews' mine)
reviewsRoot=$(ensure_resource / reviews)
by=$(ensure_resource /reviews by)
byUser=$(ensure_resource /reviews/by '{userId}')
ensure_lambda_method "$reviews" GET pagebound-social-api
ensure_lambda_method "$mine" PUT pagebound-social-api
ensure_lambda_method "$mine" DELETE pagebound-social-api
ensure_lambda_method "$byUser" GET pagebound-social-api
for rid in "$reviews" "$mine" "$reviewsRoot" "$by" "$byUser"; do ensure_options "$rid"; done

log "Require sign-in on every non-OPTIONS method"
MSYS_NO_PATHCONV=1 python "$HERE/require_auth.py"

log "Publish"
aws_ apigateway create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE" \
  --description "Phase 5: reviews, profile, avatars" --query id --output text

rm -rf "$BUILD_DIR"
