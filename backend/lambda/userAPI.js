// userAPI Lambda Function
// Handles all user-related API requests via API Gateway

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminResetUserPasswordCommand } = require("@aws-sdk/client-cognito-identity-provider");

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const httpMethod = event.httpMethod;
  const path = event.path;
  const pathParameters = event.pathParameters || {};
  
  let response;

  try {
    // GET /users/{email} - Get user profile
    if (httpMethod === 'GET' && path.match(/\/users\/[^/]+$/)) {
      const email = decodeURIComponent(pathParameters.email);
      
      const result = await dynamodb.send(new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { email }
      }));

      response = {
        statusCode: result.Item ? 200 : 404,
        body: JSON.stringify(result.Item || { error: 'User not found' })
      };
    }

    // POST /users - Create user profile
    else if (httpMethod === 'POST' && path === '/users') {
      const body = JSON.parse(event.body);
      const { email, username, isAdmin } = body;

      await dynamodb.send(new PutCommand({
        TableName: process.env.USERS_TABLE,
        Item: {
          email,
          username,
          isAdmin: isAdmin || false,
          createdAt: new Date().toISOString(),
          friends: []
        }
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'User created successfully' })
      };
    }

    // PUT /users/{email}/username - Update username
    else if (httpMethod === 'PUT' && path.match(/\/users\/[^/]+\/username$/)) {
      const email = decodeURIComponent(pathParameters.email);
      const body = JSON.parse(event.body);
      const { newUsername } = body;

      // Check if username is already taken
      const scan = await dynamodb.send(new ScanCommand({
        TableName: process.env.USERS_TABLE,
        FilterExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':username': newUsername
        }
      }));

      if (scan.Items && scan.Items.length > 0) {
        response = {
          statusCode: 400,
          body: JSON.stringify({ error: 'Username already taken' })
        };
      } else {
        await dynamodb.send(new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { email },
          UpdateExpression: 'SET username = :username',
          ExpressionAttributeValues: {
            ':username': newUsername
          }
        }));

        response = {
          statusCode: 200,
          body: JSON.stringify({ message: 'Username updated successfully' })
        };
      }
    }

    // GET /users/check-username/{username} - Check if username is available
    else if (httpMethod === 'GET' && path.match(/\/users\/check-username\/[^/]+$/)) {
      const username = decodeURIComponent(pathParameters.username);

      const scan = await dynamodb.send(new ScanCommand({
        TableName: process.env.USERS_TABLE,
        FilterExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':username': username
        }
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({ available: !scan.Items || scan.Items.length === 0 })
      };
    }

    // GET /admin/users - Get all users (admin only)
    else if (httpMethod === 'GET' && path === '/admin/users') {
      const scan = await dynamodb.send(new ScanCommand({
        TableName: process.env.USERS_TABLE
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify(scan.Items || [])
      };
    }

    // PUT /admin/users/{email}/admin - Update admin status
    else if (httpMethod === 'PUT' && path.match(/\/admin\/users\/[^/]+\/admin$/)) {
      const email = decodeURIComponent(pathParameters.email);
      const body = JSON.parse(event.body);
      const { isAdmin } = body;

      // Prevent revoking super admin
      if (email === 'hollie.tanner@gmail.com') {
        response = {
          statusCode: 403,
          body: JSON.stringify({ error: 'Cannot modify super admin status' })
        };
      } else {
        await dynamodb.send(new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { email },
          UpdateExpression: 'SET isAdmin = :isAdmin',
          ExpressionAttributeValues: {
            ':isAdmin': isAdmin
          }
        }));

        response = {
          statusCode: 200,
          body: JSON.stringify({ message: 'Admin status updated successfully' })
        };
      }
    }

    // POST /admin/reset-password - Send password reset for user
    else if (httpMethod === 'POST' && path === '/admin/reset-password') {
      const body = JSON.parse(event.body);
      const { email } = body;

      await cognito.send(new AdminResetUserPasswordCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email
      }));

      response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Password reset email sent' })
      };
    }

    else {
      response = {
        statusCode: 404,
        body: JSON.stringify({ error: 'Endpoint not found' })
      };
    }

  } catch (error) {
    console.error('Error:', error);
    response = {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }

  // Add CORS headers
  response.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  return response;
};
