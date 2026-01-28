# Manual AWS Setup for Friends Feature

If you don't have a CloudFormation stack, follow these steps to manually add the Friends infrastructure.

## Prerequisites

- AWS CLI configured
- Existing Cognito User Pool: `us-east-2_qPCehehzb`
- Region: `us-east-2`

---

## Step 1: Create DynamoDB Tables

### A. Update pagebound-users table (Add GSIs)

```bash
# Add userId index
aws dynamodb update-table \
  --table-name pagebound-users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --global-secondary-index-updates \
    '[{"Create":{"IndexName":"userId-index","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}}]' \
  --region us-east-2

# Wait for index to be active (30-60 seconds)
aws dynamodb wait table-exists --table-name pagebound-users --region us-east-2

# Add username index
aws dynamodb update-table \
  --table-name pagebound-users \
  --attribute-definitions AttributeName=username,AttributeType=S \
  --global-secondary-index-updates \
    '[{"Create":{"IndexName":"username-index","KeySchema":[{"AttributeName":"username","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}}]' \
  --region us-east-2
```

### B. Create pagebound-friends table

```bash
aws dynamodb create-table \
  --table-name pagebound-friends \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=friendUserId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=friendUserId,KeyType=RANGE \
  --global-secondary-indexes \
    '[{"IndexName":"friendUserId-index","KeySchema":[{"AttributeName":"friendUserId","KeyType":"HASH"},{"AttributeName":"userId","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2
```

### C. Create pagebound-friend-requests table

```bash
aws dynamodb create-table \
  --table-name pagebound-friend-requests \
  --attribute-definitions \
    AttributeName=toUserId,AttributeType=S \
    AttributeName=fromUserId,AttributeType=S \
    AttributeName=status,AttributeType=S \
  --key-schema \
    AttributeName=toUserId,KeyType=HASH \
    AttributeName=fromUserId,KeyType=RANGE \
  --global-secondary-indexes \
    '[{"IndexName":"fromUserId-index","KeySchema":[{"AttributeName":"fromUserId","KeyType":"HASH"},{"AttributeName":"toUserId","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"status-index","KeySchema":[{"AttributeName":"toUserId","KeyType":"HASH"},{"AttributeName":"status","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2
```

### D. Create pagebound-invite-links table

```bash
aws dynamodb create-table \
  --table-name pagebound-invite-links \
  --attribute-definitions \
    AttributeName=inviteCode,AttributeType=S \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=inviteCode,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"userId-index","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2
```

**Enable TTL on invite-links:**
```bash
aws dynamodb update-time-to-live \
  --table-name pagebound-invite-links \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAt" \
  --region us-east-2
```

---

## Step 2: Create IAM Role for Lambda

```bash
# Create trust policy file
cat > /tmp/lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create role
aws iam create-role \
  --role-name pagebound-lambda-role \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
  --region us-east-2

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name pagebound-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --region us-east-2

# Create and attach DynamoDB policy
cat > /tmp/dynamodb-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
      "dynamodb:Query",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem"
    ],
    "Resource": [
      "arn:aws:dynamodb:us-east-2:*:table/pagebound-*"
    ]
  }]
}
EOF

aws iam put-role-policy \
  --role-name pagebound-lambda-role \
  --policy-name DynamoDBAccess \
  --policy-document file:///tmp/dynamodb-policy.json \
  --region us-east-2
```

---

## Step 3: Create Friends API Lambda Function

First, get your account ID and prepare the Lambda package:

```bash
# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Navigate to lambda directory
cd d:/Design/pagebound/backend/lambda

# Create deployment package
cp friendsAPI.js index.js
zip friendsAPI.zip index.js
rm index.js

# Create the Lambda function
aws lambda create-function \
  --function-name pagebound-friends-api \
  --runtime nodejs18.x \
  --role arn:aws:iam::${ACCOUNT_ID}:role/pagebound-lambda-role \
  --handler index.handler \
  --timeout 30 \
  --zip-file fileb://friendsAPI.zip \
  --environment Variables="{USERS_TABLE=pagebound-users,FRIENDS_TABLE=pagebound-friends,FRIEND_REQUESTS_TABLE=pagebound-friend-requests,INVITE_LINKS_TABLE=pagebound-invite-links}" \
  --region us-east-2

# Clean up
rm friendsAPI.zip
```

---

## Step 4: Update Existing Lambda Functions

Update your existing Lambda functions to include the new environment variables:

```bash
# Update user API
cd d:/Design/pagebound/backend/lambda
cp userAPI.js index.js
zip userAPI.zip index.js
aws lambda update-function-code \
  --function-name pagebound-user-api \
  --zip-file fileb://userAPI.zip \
  --region us-east-2
rm index.js userAPI.zip

# Update post-confirmation
cp createUserProfile.js index.js
zip createUserProfile.zip index.js
aws lambda update-function-code \
  --function-name pagebound-post-confirmation \
  --zip-file fileb://createUserProfile.zip \
  --region us-east-2
rm index.js createUserProfile.zip
```

---

## Step 5: Add API Gateway Endpoints

You'll need to add new endpoints to your existing API Gateway. Get your API ID first:

```bash
# Get your API Gateway ID
aws apigateway get-rest-apis --region us-east-2 --query "items[?name=='pagebound-api'].id" --output text
```

Then you can either:
1. **Use AWS Console** to manually add the `/friends` endpoints (easier)
2. **Use AWS CLI** (complex, requires creating resources, methods, integrations)

I recommend using the console for this part. Would you like me to provide the console steps?

---

## Step 6: Run User Migration

```bash
cd d:/Design/pagebound/backend
npm install
node scripts/migrate-users-add-userId.js
```

---

## Verification

```bash
# Check all tables exist
aws dynamodb list-tables --region us-east-2

# Check Lambda functions
aws lambda list-functions --region us-east-2 --query "Functions[?starts_with(FunctionName, 'pagebound')].FunctionName"

# Test Friends API (replace with your API endpoint)
curl https://YOUR-API-ID.execute-api.us-east-2.amazonaws.com/prod/friends/test/list
```
