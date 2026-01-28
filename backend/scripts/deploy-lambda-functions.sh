#!/bin/bash

# Deployment Script for Pagebound Lambda Functions
# This script packages and deploys all Lambda functions to AWS

set -e  # Exit on error

REGION="us-east-2"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPTS_DIR")"
LAMBDA_DIR="$BACKEND_DIR/lambda"

echo "========================================="
echo "Pagebound Lambda Deployment Script"
echo "========================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if logged in to AWS
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: Not logged in to AWS"
    echo "Run: aws configure"
    exit 1
fi

echo "✓ AWS credentials verified"
echo ""

# Function to deploy a Lambda function
deploy_lambda() {
    local FUNCTION_NAME=$1
    local SOURCE_FILE=$2

    echo "Deploying $FUNCTION_NAME..."

    # Create deployment package
    cd "$LAMBDA_DIR"

    # Copy source file to index.js (Lambda expects index.handler)
    cp "$SOURCE_FILE" index.js

    # Create ZIP file
    zip -q deployment.zip index.js

    # Update Lambda function code
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://deployment.zip \
        --region "$REGION" \
        > /dev/null

    # Clean up
    rm index.js deployment.zip

    echo "✓ $FUNCTION_NAME deployed successfully"
}

# Deploy each Lambda function
echo "Deploying Lambda functions..."
echo ""

deploy_lambda "pagebound-user-api" "userAPI.js"
deploy_lambda "pagebound-friends-api" "friendsAPI.js"
deploy_lambda "pagebound-post-confirmation" "createUserProfile.js"

echo ""
echo "========================================="
echo "✓ All Lambda functions deployed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Run the user migration script to add userId to existing users"
echo "2. Test the API endpoints"
echo "3. Deploy the frontend"
