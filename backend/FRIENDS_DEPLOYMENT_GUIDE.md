# Friends Feature - AWS Deployment Guide

This guide walks you through deploying the Friends feature infrastructure to AWS step-by-step.

## Prerequisites

- AWS Account with admin access
- AWS CLI installed and configured (`aws configure`)
- AWS region: `us-east-2` (Ohio)

## Overview

We'll be deploying:
- 3 new DynamoDB tables (friends, friend-requests, invite-links)
- 1 new Lambda function (friends-api)
- New API Gateway endpoints
- Updates to existing resources

---

## Step 1: Understanding the Deployment Strategy

**IMPORTANT:** Since you already have a running Pagebound stack, we have two options:

### Option A: Update Existing Stack (Recommended)
Replace your existing CloudFormation template with the new one. This will:
- Add new tables and Lambda functions
- Update the Users table with Global Secondary Indexes (GSI)
- Keep all existing data intact

### Option B: Deploy Separately
Deploy a new stack alongside the existing one. You'll need to:
- Manually merge the resources later
- Update environment variables

**We'll proceed with Option A for simplicity.**

---

## Step 2: Backup Your Current Setup

Before making any changes, let's backup:

```bash
# 1. Export your current Users table data
aws dynamodb scan \
  --table-name pagebound-users \
  --region us-east-2 \
  > users-backup-$(date +%Y%m%d).json

# 2. Document your current stack
aws cloudformation describe-stacks \
  --stack-name pagebound-stack \
  --region us-east-2 \
  > stack-backup-$(date +%Y%m%d).json
```

---

## Step 3: Deploy the Updated CloudFormation Template

### 3.1: Validate the Template

```bash
cd d:\Design\pagebound\backend

aws cloudformation validate-template \
  --template-body file://cloudformation-template-friends.yaml \
  --region us-east-2
```

You should see a success message with template details.

### 3.2: Deploy/Update the Stack

**If this is your FIRST deployment:**
```bash
aws cloudformation create-stack \
  --stack-name pagebound-stack \
  --template-body file://cloudformation-template-friends.yaml \
  --capabilities CAPABILITY_IAM \
  --region us-east-2
```

**If UPDATING an existing stack:**
```bash
aws cloudformation update-stack \
  --stack-name pagebound-stack \
  --template-body file://cloudformation-template-friends.yaml \
  --capabilities CAPABILITY_IAM \
  --region us-east-2
```

### 3.3: Monitor the Deployment

```bash
# Watch the stack events in real-time
aws cloudformation describe-stack-events \
  --stack-name pagebound-stack \
  --region us-east-2 \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table
```

**Expected deployment time:** 5-10 minutes

### 3.4: Verify Deployment Success

```bash
aws cloudformation describe-stacks \
  --stack-name pagebound-stack \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'
```

Should return: `"CREATE_COMPLETE"` or `"UPDATE_COMPLETE"`

---

## Step 4: Retrieve Output Values

After successful deployment, get your new resources:

```bash
aws cloudformation describe-stacks \
  --stack-name pagebound-stack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table
```

**Save these values** - you'll need them:
- `ApiEndpoint` - Your API Gateway URL
- `FriendsTableName` - Should be `pagebound-friends`
- `FriendRequestsTableName` - Should be `pagebound-friend-requests`
- `InviteLinksTableName` - Should be `pagebound-invite-links`
- `FriendsAPIFunctionArn` - Lambda function ARN

---

## Step 5: Verify DynamoDB Tables

Check that all tables were created:

```bash
# List all tables
aws dynamodb list-tables --region us-east-2

# Describe the Friends table
aws dynamodb describe-table \
  --table-name pagebound-friends \
  --region us-east-2

# Describe the Friend Requests table
aws dynamodb describe-table \
  --table-name pagebound-friend-requests \
  --region us-east-2

# Describe the Invite Links table
aws dynamodb describe-table \
  --table-name pagebound-invite-links \
  --region us-east-2
```

**Expected output:** Each table should show:
- Status: `ACTIVE`
- BillingMode: `PAY_PER_REQUEST`
- Global Secondary Indexes listed

---

## Step 6: Update Existing Users Table (Add userId Field)

Since your existing users don't have a `userId` field, we need to migrate them. We'll create a migration script:

### 6.1: Create Migration Script

Create `backend/scripts/migrate-users-add-userId.js`:

```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const ddbClient = new DynamoDBClient({ region: 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-2' });

const USER_POOL_ID = 'us-east-2_qPCehehzb';
const USERS_TABLE = 'pagebound-users';

async function getUserIdFromCognito(email) {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email
    });
    const response = await cognitoClient.send(command);

    // Find the 'sub' attribute (this is the userId)
    const subAttr = response.UserAttributes.find(attr => attr.Name === 'sub');
    return subAttr ? subAttr.Value : null;
  } catch (error) {
    console.error(`Error getting userId for ${email}:`, error.message);
    return null;
  }
}

async function migrateUsers() {
  console.log('Starting user migration...\n');

  // Scan all users
  const scanCommand = new ScanCommand({
    TableName: USERS_TABLE
  });

  const result = await docClient.send(scanCommand);
  const users = result.Items || [];

  console.log(`Found ${users.length} users to migrate\n`);

  for (const user of users) {
    if (user.userId) {
      console.log(`✓ ${user.email} already has userId: ${user.userId}`);
      continue;
    }

    console.log(`Processing ${user.email}...`);
    const userId = await getUserIdFromCognito(user.email);

    if (!userId) {
      console.error(`✗ Could not get userId for ${user.email}`);
      continue;
    }

    // Update the user record with userId
    const updateCommand = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { email: user.email },
      UpdateExpression: 'SET userId = :userId, displayName = :displayName, isPrivate = :isPrivate, friendsCount = :friendsCount, publicShelves = :publicShelves',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':displayName': user.username || user.email.split('@')[0],
        ':isPrivate': false,
        ':friendsCount': 0,
        ':publicShelves': []
      }
    });

    await docClient.send(updateCommand);
    console.log(`✓ Updated ${user.email} with userId: ${userId}`);
  }

  console.log('\n✓ Migration complete!');
}

migrateUsers().catch(console.error);
```

### 6.2: Install Dependencies

```bash
cd d:\Design\pagebound\backend
npm init -y  # if you don't have package.json
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-cognito-identity-provider
```

### 6.3: Run the Migration

```bash
node scripts/migrate-users-add-userId.js
```

**Expected output:**
```
Starting user migration...

Found 1 users to migrate

Processing hollie.tanner@gmail.com...
✓ Updated hollie.tanner@gmail.com with userId: abc123-def456-...

✓ Migration complete!
```

---

## Step 7: Deploy Lambda Functions

Now we need to deploy the actual Lambda function code (the CloudFormation template only created placeholders).

### 7.1: Package and Deploy Friends API Lambda

We'll create the Lambda function code next, but here's how to deploy it:

```bash
cd d:\Design\pagebound\backend\lambda

# Create a deployment package
zip -r friendsAPI.zip friendsAPI.js node_modules/

# Upload to Lambda
aws lambda update-function-code \
  --function-name pagebound-friends-api \
  --zip-file fileb://friendsAPI.zip \
  --region us-east-2
```

### 7.2: Update Post-Confirmation Lambda (to include userId)

Similarly, update the post-confirmation function to set userId on new signups.

---

## Step 8: Test the API Endpoints

### 8.1: Get Your API Endpoint

```bash
aws cloudformation describe-stacks \
  --stack-name pagebound-stack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

### 8.2: Test the Friends Endpoints

**Example: Get friends list**
```bash
curl https://YOUR-API-ID.execute-api.us-east-2.amazonaws.com/prod/friends/YOUR-USER-ID/list
```

**Example: Search users**
```bash
curl "https://YOUR-API-ID.execute-api.us-east-2.amazonaws.com/prod/friends/YOUR-USER-ID/search?q=hollie"
```

---

## Step 9: Update Frontend Environment Variables

Update your `.env` file if the API endpoint changed:

```env
REACT_APP_API_ENDPOINT=https://YOUR-API-ID.execute-api.us-east-2.amazonaws.com/prod
```

---

## Troubleshooting

### Issue: CloudFormation Update Fails

**Error:** "Resource already exists"
- **Solution:** The stack name might conflict. Use a different stack name or update the existing one.

### Issue: GSI Creation on Existing Table Fails

**Error:** "Cannot add GSI to existing table"
- **Solution:** DynamoDB doesn't allow adding GSI via CloudFormation update. You'll need to:
  1. Create a new table with GSI
  2. Migrate data
  3. Swap table names

**Alternative:** Add GSI manually:
```bash
aws dynamodb update-table \
  --table-name pagebound-users \
  --attribute-definitions \
      AttributeName=userId,AttributeType=S \
  --global-secondary-index-updates \
      '[{"Create":{"IndexName":"userId-index","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}}]' \
  --region us-east-2
```

### Issue: Lambda Permission Denied

**Error:** "User is not authorized to perform: lambda:UpdateFunctionCode"
- **Solution:** Ensure your AWS credentials have Lambda write permissions.

---

## Next Steps

After successful deployment:

1. ✓ CloudFormation stack deployed
2. ✓ DynamoDB tables created
3. ✓ Users migrated with userId
4. ✓ Lambda functions deployed
5. → **Next:** Deploy the Lambda function code (we'll create this next)
6. → **Next:** Build the React frontend components

---

## Rollback Instructions

If something goes wrong:

```bash
# Rollback CloudFormation stack
aws cloudformation cancel-update-stack \
  --stack-name pagebound-stack \
  --region us-east-2

# Or delete and recreate from backup
aws cloudformation delete-stack \
  --stack-name pagebound-stack \
  --region us-east-2
```

---

## Cost Estimation

**Expected AWS costs for Friends feature:**
- DynamoDB (3 tables, PAY_PER_REQUEST): ~$1-5/month for low usage
- Lambda (Friends API): ~$0.20/month for 10K requests
- API Gateway: ~$3.50/month for 1M requests
- **Total estimated:** ~$5-10/month for small-scale usage

---

## Need Help?

If you encounter issues during deployment:
1. Check CloudFormation events for error details
2. Verify IAM permissions
3. Ensure AWS region is correct (us-east-2)
4. Check Lambda logs in CloudWatch

Ready to proceed? Let me know when you've completed the deployment, and I'll help you with the Lambda function code!
