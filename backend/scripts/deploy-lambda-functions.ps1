# PowerShell Deployment Script for Pagebound Lambda Functions
# This script packages and deploys all Lambda functions to AWS

$ErrorActionPreference = "Stop"

$REGION = "us-east-2"
$SCRIPTS_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Split-Path -Parent $SCRIPTS_DIR
$LAMBDA_DIR = Join-Path $BACKEND_DIR "lambda"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Pagebound Lambda Deployment Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
    Write-Host "✓ AWS CLI found" -ForegroundColor Green
}
catch {
    Write-Host "Error: AWS CLI is not installed" -ForegroundColor Red
    Write-Host "Install it from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Check if logged in to AWS
Write-Host "Checking AWS credentials..."
try {
    aws sts get-caller-identity | Out-Null
    Write-Host "✓ AWS credentials verified" -ForegroundColor Green
}
catch {
    Write-Host "Error: Not logged in to AWS" -ForegroundColor Red
    Write-Host "Run: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Function to deploy a Lambda function
function Deploy-Lambda {
    param(
        [string]$FunctionName,
        [string]$SourceFile
    )

    Write-Host "Deploying $FunctionName..." -ForegroundColor Yellow

    # Navigate to Lambda directory
    Push-Location $LAMBDA_DIR

    try {
        # Copy source file to index.js (Lambda expects index.handler)
        Copy-Item $SourceFile -Destination "index.js" -Force

        # Create ZIP file
        Compress-Archive -Path "index.js" -DestinationPath "deployment.zip" -Force

        # Update Lambda function code
        aws lambda update-function-code `
            --function-name $FunctionName `
            --zip-file fileb://deployment.zip `
            --region $REGION `
            | Out-Null

        # Clean up
        Remove-Item "index.js" -Force
        Remove-Item "deployment.zip" -Force

        Write-Host "✓ $FunctionName deployed successfully" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

# Deploy each Lambda function
Write-Host "Deploying Lambda functions..." -ForegroundColor Cyan
Write-Host ""

Deploy-Lambda -FunctionName "pagebound-user-api" -SourceFile "userAPI.js"
Deploy-Lambda -FunctionName "pagebound-friends-api" -SourceFile "friendsAPI.js"
Deploy-Lambda -FunctionName "pagebound-post-confirmation" -SourceFile "createUserProfile.js"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✓ All Lambda functions deployed!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run the user migration script to add userId to existing users"
Write-Host "2. Test the API endpoints"
Write-Host "3. Deploy the frontend"
