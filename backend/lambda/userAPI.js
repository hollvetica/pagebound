// userAPI Lambda Function
// Handles all user-related API requests via API Gateway

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminResetUserPasswordCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const cognito = new CognitoIdentityProviderClient({});
const s3Client = new S3Client({});

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

    // POST /users/{email}/avatar-upload-url - Generate presigned S3 URL for avatar upload
    else if (httpMethod === 'POST' && path.match(/\/users\/[^/]+\/avatar-upload-url$/)) {
      const email = decodeURIComponent(pathParameters.email);
      const body = JSON.parse(event.body);
      const { fileType } = body;

      // Get userId from user record
      const userResult = await dynamodb.send(new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { email }
      }));

      if (!userResult.Item) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' })
        };
      } else {
        const userId = userResult.Item.userId;
        const timestamp = Date.now();
        const extension = fileType.split('/')[1] || 'jpg';
        const key = `avatars/${userId}-${timestamp}.${extension}`;

        const command = new PutObjectCommand({
          Bucket: process.env.PROFILE_IMAGES_BUCKET || 'pagebound-profile-images',
          Key: key,
          ContentType: fileType
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
        const imageUrl = `https://${process.env.PROFILE_IMAGES_BUCKET || 'pagebound-profile-images'}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`;

        response = {
          statusCode: 200,
          body: JSON.stringify({ uploadUrl, imageUrl, expiresIn: 300 })
        };
      }
    }

    // POST /users/{email}/avatar-confirm - Confirm avatar upload and update DB
    else if (httpMethod === 'POST' && path.match(/\/users\/[^/]+\/avatar-confirm$/)) {
      const email = decodeURIComponent(pathParameters.email);
      const body = JSON.parse(event.body);
      const { imageUrl } = body;

      // Get current user to find old avatar
      const userResult = await dynamodb.send(new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { email }
      }));

      if (!userResult.Item) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' })
        };
      } else {
        const oldAvatarUrl = userResult.Item.avatarUrl;

        // Update avatarUrl in DynamoDB
        await dynamodb.send(new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { email },
          UpdateExpression: 'SET avatarUrl = :url, updatedAt = :time',
          ExpressionAttributeValues: {
            ':url': imageUrl,
            ':time': new Date().toISOString()
          }
        }));

        // Delete old avatar from S3 if it exists
        if (oldAvatarUrl && oldAvatarUrl.includes('pagebound-profile-images')) {
          try {
            const oldKey = oldAvatarUrl.split('.com/')[1];
            await s3Client.send(new DeleteObjectCommand({
              Bucket: process.env.PROFILE_IMAGES_BUCKET || 'pagebound-profile-images',
              Key: oldKey
            }));
          } catch (deleteError) {
            console.log('Error deleting old avatar:', deleteError.message);
            // Continue even if delete fails
          }
        }

        response = {
          statusCode: 200,
          body: JSON.stringify({ success: true, avatarUrl: imageUrl })
        };
      }
    }

    // PUT /users/{email}/profile - Update profile (tagline, favoriteBooks, bio)
    else if (httpMethod === 'PUT' && path.match(/\/users\/[^/]+\/profile$/)) {
      const email = decodeURIComponent(pathParameters.email);
      const body = JSON.parse(event.body);
      const { tagline, favoriteBooks, bio } = body;

      // Validate inputs
      if (tagline !== undefined && tagline.length > 255) {
        response = {
          statusCode: 400,
          body: JSON.stringify({ error: 'Tagline must be 255 characters or less' })
        };
      } else if (favoriteBooks !== undefined && favoriteBooks.length > 10) {
        response = {
          statusCode: 400,
          body: JSON.stringify({ error: 'Cannot have more than 10 favorite books' })
        };
      } else {
        // Build update expression dynamically
        const updateParts = [];
        const values = {};
        const names = {};

        if (tagline !== undefined) {
          updateParts.push('#tagline = :tagline');
          values[':tagline'] = tagline;
          names['#tagline'] = 'tagline';
        }
        if (favoriteBooks !== undefined) {
          updateParts.push('favoriteBooks = :books');
          values[':books'] = favoriteBooks;
        }
        if (bio !== undefined) {
          updateParts.push('bio = :bio');
          values[':bio'] = bio;
        }
        updateParts.push('updatedAt = :time');
        values[':time'] = new Date().toISOString();

        const updateParams = {
          TableName: process.env.USERS_TABLE,
          Key: { email },
          UpdateExpression: 'SET ' + updateParts.join(', '),
          ExpressionAttributeValues: values,
          ...(Object.keys(names).length > 0 && { ExpressionAttributeNames: names })
        };

        await dynamodb.send(new UpdateCommand(updateParams));

        response = {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      }
    }

    // GET /users/{email}/stats - Get user reading stats
    else if (httpMethod === 'GET' && path.match(/\/users\/[^/]+\/stats$/)) {
      const email = decodeURIComponent(pathParameters.email);

      // Get user to find userId
      const userResult = await dynamodb.send(new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { email }
      }));

      if (!userResult.Item) {
        response = {
          statusCode: 404,
          body: JSON.stringify({ error: 'User not found' })
        };
      } else {
        const userId = userResult.Item.userId;

        // Query library table for stats
        const libraryResult = await dynamodb.send(new QueryCommand({
          TableName: process.env.LIBRARY_TABLE || 'pagebound-library',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId
          }
        }));

        const books = libraryResult.Items || [];

        // Calculate stats
        const booksRead = books.filter(b => b.shelf === 'Read').length;
        const chaptersCompleted = books
          .filter(b => b.shelf === 'Read')
          .reduce((sum, book) => sum + (book.totalChapters || 0), 0);

        const stats = {
          chaptersCompleted,
          booksRead,
          totalBooks: books.length,
          joinedDate: userResult.Item.createdAt
        };

        // Cache stats in user record
        await dynamodb.send(new UpdateCommand({
          TableName: process.env.USERS_TABLE,
          Key: { email },
          UpdateExpression: 'SET stats = :stats',
          ExpressionAttributeValues: {
            ':stats': stats
          }
        }));

        response = {
          statusCode: 200,
          body: JSON.stringify(stats)
        };
      }
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
