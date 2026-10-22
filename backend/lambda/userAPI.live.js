// User API Lambda (pagebound-user-api) – the version that is deployed.
//
// userAPI.js next to this file is a larger, not-yet-deployed rewrite (avatar
// uploads, profile fields, stats). Until that ships, this file is the source
// of truth for the live function.
//
// Every request is authenticated by the API Gateway Cognito authorizer.
//   - Profiles: callers can read and rename only themselves.
//   - Admin: listing users and password resets need isAdmin; granting or
//     revoking admin is reserved for the super admin.

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminResetUserPasswordCommand } = require("@aws-sdk/client-cognito-identity-provider");

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(ddbClient);
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const SUPER_ADMIN_EMAIL = 'hollie.tanner@gmail.com';

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
const sameEmail = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

async function getUser(email) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { email }
  }));
  return result.Item || null;
}

exports.handler = async (event) => {
  console.log('Request:', event.httpMethod, event.path);

  const { httpMethod, pathParameters = {}, body } = event;
  const proxy = (pathParameters && pathParameters.proxy) || '';
  const callerEmail = event.requestContext?.authorizer?.claims?.email;
  const segments = proxy.split('/');
  const isAdminList = segments[0] === 'admin';
  const isAdminFlag = segments.length > 1 && segments[segments.length - 1] === 'admin';
  const isUsername = segments.length > 1 && segments[segments.length - 1] === 'username';

  let response;

  try {
    if (!callerEmail) {
      response = json(401, { error: 'Not signed in' });
    }
    // Check username availability
    else if (httpMethod === 'GET' && proxy.includes('check-username')) {
      const username = decodeURIComponent(proxy.split('/').pop());
      const result = await dynamodb.send(new ScanCommand({
        TableName: process.env.USERS_TABLE,
        FilterExpression: 'username = :username',
        ExpressionAttributeValues: { ':username': username }
      }));
      response = json(200, { available: !result.Items || result.Items.length === 0 });
    }
    // Get all users (admin)
    else if (httpMethod === 'GET' && isAdminList) {
      const caller = await getUser(callerEmail);
      if (!caller?.isAdmin) {
        response = json(403, { error: 'Admins only' });
      } else {
        const result = await dynamodb.send(new ScanCommand({ TableName: process.env.USERS_TABLE }));
        response = json(200, result.Items || []);
      }
    }
    // GET own profile
    else if (httpMethod === 'GET') {
      const email = decodeURIComponent(proxy.split('/')[0] || proxy);
      if (!sameEmail(email, callerEmail)) {
        response = json(403, { error: 'You can only view your own account' });
      } else {
        const user = await getUser(email);
        response = json(user ? 200 : 404, user || { error: 'Not found' });
      }
    }
    // Update own username
    else if (httpMethod === 'PUT' && isUsername) {
      const email = decodeURIComponent(proxy.split('/')[0]);
      if (!sameEmail(email, callerEmail)) {
        response = json(403, { error: 'You can only rename your own account' });
      } else {
        const { newUsername } = JSON.parse(body || '{}');
        if (!newUsername || !String(newUsername).trim()) {
          response = json(400, { error: 'Username is required' });
        } else {
          await dynamodb.send(new UpdateCommand({
            TableName: process.env.USERS_TABLE,
            Key: { email },
            UpdateExpression: 'SET username = :username',
            ExpressionAttributeValues: { ':username': String(newUsername).trim() }
          }));
          response = json(200, { message: 'Updated' });
        }
      }
    }
    // Grant / revoke admin (super admin only)
    else if (httpMethod === 'PUT' && isAdminFlag) {
      const email = decodeURIComponent(proxy.split('/')[0]);
      if (!sameEmail(callerEmail, SUPER_ADMIN_EMAIL)) {
        response = json(403, { error: 'Only the super admin can change admin status' });
      } else if (sameEmail(email, SUPER_ADMIN_EMAIL)) {
        response = json(403, { error: 'Cannot modify super admin' });
      } else {
        const { isAdmin } = JSON.parse(body || '{}');
        await dynamodb.send(new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { email },
          UpdateExpression: 'SET isAdmin = :isAdmin',
          ExpressionAttributeValues: { ':isAdmin': !!isAdmin }
        }));
        response = json(200, { message: 'Updated' });
      }
    }
    // Reset another user's password (admin)
    else if (httpMethod === 'POST' && proxy.includes('reset-password')) {
      const caller = await getUser(callerEmail);
      if (!caller?.isAdmin) {
        response = json(403, { error: 'Admins only' });
      } else {
        const { email } = JSON.parse(body || '{}');
        await cognito.send(new AdminResetUserPasswordCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: email
        }));
        response = json(200, { message: 'Reset sent' });
      }
    }
    else {
      response = json(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    response = json(500, { error: 'Something went wrong' });
  }

  response.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  return response;
};
