# Backend Deployment Guide

This guide walks through deploying the Pagebound backend infrastructure for the discussion feature.

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS account with permissions for:
  - DynamoDB
  - Lambda
  - API Gateway
  - IAM
  - CloudFormation
- Node.js 18.x installed locally (for testing)

## Deployment Steps

### 1. Create DynamoDB Tables

Create the Sessions table:
```bash
aws dynamodb create-table --cli-input-json file://create-sessions-tables.json --region us-east-1
```

Create the Messages table:
```bash
aws dynamodb create-table --cli-input-json file://create-messages-table.json --region us-east-1
```

Verify tables are active:
```bash
aws dynamodb list-tables --region us-east-1
aws dynamodb describe-table --table-name pagebound-sessions --region us-east-1
aws dynamodb describe-table --table-name pagebound-messages --region us-east-1
```

### 2. Package Lambda Function

Create a deployment package for the Sessions API:

```bash
cd lambda
mkdir -p package
npm init -y
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
cp -r node_modules package/
cp sessionsAPI.js package/index.js
cd package
zip -r ../sessionsAPI.zip .
cd ../..
```

### 3. Deploy Lambda Function

Create/update the Lambda function:

```bash
# If creating new function
aws lambda create-function \
  --function-name pagebound-sessions-api \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/pagebound-lambda-role \
  --handler index.handler \
  --zip-file fileb://lambda/sessionsAPI.zip \
  --environment Variables="{USERS_TABLE=pagebound-users,SESSIONS_TABLE=pagebound-sessions,MESSAGES_TABLE=pagebound-messages}" \
  --timeout 30 \
  --memory-size 256 \
  --region us-east-1

# If updating existing function
aws lambda update-function-code \
  --function-name pagebound-sessions-api \
  --zip-file fileb://lambda/sessionsAPI.zip \
  --region us-east-1
```

### 4. Update API Gateway

Add routes for the Sessions API to your existing API Gateway:

**Required Routes:**
- POST /sessions
- GET /sessions/{userId}/list
- GET /sessions/{sessionId}
- PUT /sessions/{sessionId}/progress
- POST /sessions/{sessionId}/messages
- GET /sessions/{sessionId}/messages
- PUT /sessions/{sessionId}/messages/{messageId}/read
- GET /sessions/{sessionId}/unread-timeline
- DELETE /sessions/{sessionId}

**AWS Console Method:**
1. Go to API Gateway console
2. Select your pagebound-api
3. Create resources and methods as listed above
4. Set integration type to Lambda Function
5. Select pagebound-sessions-api function
6. Enable CORS for each method
7. Deploy to prod stage

**AWS CLI Method:**
```bash
# Get API ID
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='pagebound-api'].id" --output text --region us-east-1)

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/'].id" --output text --region us-east-1)

# Create /sessions resource
SESSIONS_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part sessions \
  --query 'id' \
  --output text \
  --region us-east-1)

# Create POST /sessions method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $SESSIONS_ID \
  --http-method POST \
  --authorization-type NONE \
  --region us-east-1

# Continue for all other routes...
# (See full script in setup-api-gateway.sh)

# Deploy API
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region us-east-1
```

### 5. Update Frontend Configuration

Set the API endpoint in your frontend environment:

```bash
# .env.local or .env.production
REACT_APP_API_ENDPOINT=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
```

### 6. Grant Lambda Permissions

Ensure Lambda has permissions to invoke from API Gateway:

```bash
aws lambda add-permission \
  --function-name pagebound-sessions-api \
  --statement-id apigateway-sessions \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:YOUR_ACCOUNT_ID:YOUR_API_ID/*/*" \
  --region us-east-1
```

## Testing the Deployment

### Test DynamoDB Tables

```bash
# Test Sessions table
aws dynamodb put-item \
  --table-name pagebound-sessions \
  --item file://test-session.json \
  --region us-east-1

aws dynamodb scan --table-name pagebound-sessions --region us-east-1
```

### Test Lambda Function

```bash
# Test with sample event
aws lambda invoke \
  --function-name pagebound-sessions-api \
  --payload file://test-events/create-session.json \
  --region us-east-1 \
  response.json

cat response.json
```

### Test API Endpoints

```bash
# Get API endpoint
API_ENDPOINT=$(aws apigateway get-rest-api --rest-api-id $API_ID --query 'id' --output text --region us-east-1)
echo "https://${API_ENDPOINT}.execute-api.us-east-1.amazonaws.com/prod"

# Test create session
curl -X POST \
  https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/sessions \
  -H 'Content-Type: application/json' \
  -d @test-events/create-session.json

# Test get messages
curl https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/sessions/SESSION_ID/messages?userId=USER_ID
```

## CloudFormation Deployment (Alternative)

Instead of manual steps, deploy everything with CloudFormation:

```bash
# Package the CloudFormation template
aws cloudformation package \
  --template-file cloudformation-template.yaml \
  --s3-bucket YOUR_DEPLOYMENT_BUCKET \
  --output-template-file packaged-template.yaml \
  --region us-east-1

# Deploy the stack
aws cloudformation deploy \
  --template-file packaged-template.yaml \
  --stack-name pagebound-infrastructure \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Get outputs
aws cloudformation describe-stacks \
  --stack-name pagebound-infrastructure \
  --query 'Stacks[0].Outputs' \
  --region us-east-1
```

## Monitoring and Logs

### View Lambda Logs

```bash
# Get log streams
aws logs describe-log-streams \
  --log-group-name /aws/lambda/pagebound-sessions-api \
  --order-by LastEventTime \
  --descending \
  --max-items 5 \
  --region us-east-1

# Get recent logs
aws logs tail /aws/lambda/pagebound-sessions-api --follow --region us-east-1
```

### Monitor DynamoDB

```bash
# Check table metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=pagebound-sessions \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-east-1
```

## Troubleshooting

### Lambda Function Errors

1. **Check CloudWatch Logs**: Most errors appear in Lambda logs
2. **Verify IAM Permissions**: Ensure Lambda role has DynamoDB access
3. **Check Environment Variables**: Verify table names are correct
4. **Test Locally**: Run sessionsAPI.js locally with mock events

### API Gateway Issues

1. **Enable CloudWatch Logs**: Turn on execution logging in API Gateway
2. **Check CORS**: Ensure CORS headers are enabled
3. **Verify Integration**: Test Lambda integration in console
4. **Check Authorizers**: Ensure authentication is configured correctly

### DynamoDB Issues

1. **Check Table Status**: Tables must be ACTIVE
2. **Verify Indexes**: GSIs must be ACTIVE
3. **Check Capacity**: Ensure read/write capacity is sufficient (or use on-demand)
4. **Review Access Patterns**: Optimize queries for your access patterns

## Cost Estimation

**Monthly costs for moderate usage:**
- DynamoDB (on-demand): $5-20
- Lambda: $5-15
- API Gateway: $3-10
- CloudWatch Logs: $1-5

**Total: ~$15-50/month**

Costs scale with usage. Monitor CloudWatch for actual metrics.

## Security Considerations

1. **Enable API Authentication**: Add Cognito authorizer to API Gateway
2. **Use VPC**: Deploy Lambda in VPC for additional security
3. **Encrypt Data**: Enable encryption at rest for DynamoDB
4. **Rotate Credentials**: Regularly rotate IAM credentials
5. **Monitor Access**: Set up CloudTrail for API access logging
6. **Rate Limiting**: Configure API Gateway throttling

## Rollback

If deployment fails or issues arise:

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name pagebound-infrastructure \
  --region us-east-1

# Or manually delete resources
aws dynamodb delete-table --table-name pagebound-sessions --region us-east-1
aws dynamodb delete-table --table-name pagebound-messages --region us-east-1
aws lambda delete-function --function-name pagebound-sessions-api --region us-east-1
```

## Next Steps

After successful deployment:

1. Update frontend environment variables
2. Test discussion feature in development
3. Migrate existing sessions from localStorage to DynamoDB
4. Set up monitoring and alerts
5. Configure backup strategy for DynamoDB
6. Implement authentication for API endpoints
7. Set up CI/CD pipeline for future deployments

## Support

For issues or questions:
- Check CloudWatch Logs for errors
- Review DynamoDB metrics
- Test API endpoints with curl/Postman
- Verify IAM permissions
- Check CloudFormation events for deployment issues
