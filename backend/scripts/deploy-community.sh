#!/usr/bin/env bash
# Deploys the everyone feed + bot visibility (social, library and friends
# Lambdas), then optionally seeds the bots and turns them on for one account.
#
#   bash backend/scripts/deploy-community.sh                 deploy only
#   bash backend/scripts/deploy-community.sh you@example.com deploy, seed bots, bots on for you
set -euo pipefail
export MSYS_NO_PATHCONV=1
export AWS_REGION="${AWS_REGION:-us-east-2}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Path conversion is off for the AWS CLI, so hand Node a Windows-style path
if command -v cygpath >/dev/null; then ROOT="$(cygpath -m "$ROOT")"; fi
LAMBDA_DIR="$ROOT/backend/lambda"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

zip_lambda() { # <source .js> <name> -> zip path (index.js + shared profiles.js)
  mkdir -p "$BUILD_DIR/$2"
  cp "$LAMBDA_DIR/$1" "$BUILD_DIR/$2/index.js"
  cp "$LAMBDA_DIR/profiles.js" "$BUILD_DIR/$2/profiles.js"
  (cd "$BUILD_DIR/$2" && python -c "import zipfile; z=zipfile.ZipFile('../$2.zip','w',zipfile.ZIP_DEFLATED); z.write('index.js'); z.write('profiles.js'); z.close()")
  if command -v cygpath >/dev/null; then cygpath -w "$BUILD_DIR/$2.zip"; else echo "$BUILD_DIR/$2.zip"; fi
}

echo "Running backend tests first..."
node "$ROOT/backend/tests/api.test.js" | tail -1

for pair in socialAPI.js:pagebound-social-api libraryAPI.js:pagebound-library-api friendsAPI.js:pagebound-friends-api; do
  src="${pair%%:*}"; fn="${pair##*:}"
  echo "Deploying $fn..."
  aws lambda update-function-code --function-name "$fn" --zip-file "fileb://$(zip_lambda "$src" "${fn#pagebound-}")" --query FunctionName --output text >/dev/null
  aws lambda wait function-updated --function-name "$fn"
done
echo "Deployed."

if [ -n "${1:-}" ]; then
  node "$ROOT/backend/scripts/bots.js" seed
  node "$ROOT/backend/scripts/bots.js" on "$1"
  node "$ROOT/backend/scripts/bots.js" status
fi
