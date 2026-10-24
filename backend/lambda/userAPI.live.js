// User API Lambda (pagebound-user-api) – the version that is deployed.
//
// userAPI.js next to this file is an older, never-deployed draft; this file
// is the source of truth for the live function.
//
// Every request is authenticated by the API Gateway Cognito authorizer.
//   - Profiles: callers can read, rename and edit only themselves
//     (tagline, favorite books, private profile, avatar, stats).
//   - Admin: listing users and password resets need isAdmin; granting or
//     revoking admin is reserved for the super admin.
//
// Routes (all under /users/{proxy+}):
//   GET  {email}                 own profile (created on the spot if the
//                                sign-up trigger didn't; see profiles.js)
//   GET  {email}/stats           own reading stats
//   PUT  {email}/username        rename
//   PUT  {email}/profile         { tagline, favoriteBooks, isPrivate }
//   POST {email}/avatar          { imageData: "data:image/jpeg;base64,..." }
//   GET  check-username/{name}, GET admin, PUT {email}/admin, POST reset-password

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminResetUserPasswordCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { USERNAME_RULE, emailKey, cleanUsername, isUsernameTaken, createProfileIfMissing } = require('./profiles');

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(ddbClient);
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const SUPER_ADMIN_EMAIL = 'hollie.tanner@gmail.com';
const LIBRARY_TABLE = process.env.LIBRARY_TABLE || 'pagebound-library';
const FRIENDS_TABLE = process.env.FRIENDS_TABLE || 'pagebound-friends';
const AVATAR_BUCKET = process.env.AVATAR_BUCKET;
const MAX_AVATAR_BYTES = 1024 * 1024;
const MAX_FAVORITES = 10;
const MAX_TAGLINE = 255;

// The S3 client ships with the Lambda runtime; load it only when needed
let s3 = null;
function s3Client() {
  if (!s3) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3 = new S3Client({ region: process.env.AWS_REGION });
  }
  return s3;
}

const avatarBaseUrl = () => `https://${AVATAR_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/`;

// Image type from the file's first bytes (not the claimed MIME type)
function sniffImage(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', type: 'image/png' };
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

const cleanBookCard = (b) => ({
  isbn: String(b.isbn || '').slice(0, 100),
  title: String(b.title || '').slice(0, 300),
  author: String(b.author || '').slice(0, 300),
  coverUrl: b.coverUrl ? String(b.coverUrl).slice(0, 1000) : null
});

const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};
const finish = (response) => ({ ...response, headers: CORS_HEADERS });
const sameEmail = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

// Profiles are keyed by lowercase email
async function getUser(email) {
  const result = await dynamodb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { email: emailKey(email) }
  }));
  return result.Item || null;
}

exports.handler = async (event) => {
  console.log('Request:', event.httpMethod, event.path);

  const { httpMethod, pathParameters = {}, body } = event;
  const proxy = (pathParameters && pathParameters.proxy) || '';
  const claims = event.requestContext?.authorizer?.claims || {};
  const callerEmail = claims.email;
  const segments = proxy.split('/');
  const isAdminList = segments[0] === 'admin';
  const isAdminFlag = segments.length > 1 && segments[segments.length - 1] === 'admin';
  const isUsername = segments.length > 1 && segments[segments.length - 1] === 'username';
  const action = segments.length > 1 ? segments[segments.length - 1] : null;
  const targetEmail = emailKey(decodeURIComponent(segments[0] || ''));
  const isSelf = sameEmail(targetEmail, callerEmail);

  let response;

  try {
    if (!callerEmail) {
      response = json(401, { error: 'Not signed in' });
    }
    // Check username availability
    else if (httpMethod === 'GET' && proxy.includes('check-username')) {
      const username = cleanUsername(decodeURIComponent(proxy.split('/').pop()));
      response = json(200, {
        available: !!username && !(await isUsernameTaken(dynamodb, process.env.USERS_TABLE, username, callerEmail))
      });
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
    // GET own reading stats
    else if (httpMethod === 'GET' && action === 'stats') {
      if (!isSelf) {
        response = json(403, { error: 'You can only view your own stats' });
      } else {
        const user = await getUser(targetEmail);
        const userId = user?.userId;
        const [books, friends] = userId ? await Promise.all([
          dynamodb.send(new QueryCommand({
            TableName: LIBRARY_TABLE,
            KeyConditionExpression: 'userId = :u',
            ExpressionAttributeValues: { ':u': userId }
          })).then(r => r.Items || []),
          dynamodb.send(new QueryCommand({
            TableName: FRIENDS_TABLE,
            KeyConditionExpression: 'userId = :u',
            ExpressionAttributeValues: { ':u': userId }
          })).then(r => r.Items || [])
        ]) : [[], []];
        const finished = books.filter(b => ['Finished', 'Read'].includes(b.shelf));
        response = json(200, {
          totalBooks: books.length,
          booksRead: finished.length,
          currentlyReading: books.filter(b => b.shelf === 'Currently Reading').length,
          chaptersCompleted: finished.reduce((sum, b) => sum + (Number(b.totalChapters) || 0), 0),
          friendsCount: friends.length,
          joinedDate: user?.createdAt || null
        });
      }
    }
    // GET own profile. Safety net: a signed-in reader without a profile (the
    // sign-up trigger failed or wasn't attached) gets one now.
    else if (httpMethod === 'GET') {
      const email = decodeURIComponent(proxy.split('/')[0] || proxy);
      if (!sameEmail(email, callerEmail)) {
        response = json(403, { error: 'You can only view your own account' });
      } else {
        let user = await getUser(email);
        if (!user && claims.sub) {
          ({ profile: user } = await createProfileIfMissing(dynamodb, {
            table: process.env.USERS_TABLE,
            email: callerEmail,
            userId: claims.sub,
            wantedUsername: claims['custom:username']
          }));
          console.log('Created missing profile for', claims.sub);
        }
        response = json(user ? 200 : 404, user || { error: 'Not found' });
      }
    }
    // Update own username
    else if (httpMethod === 'PUT' && isUsername) {
      const email = emailKey(decodeURIComponent(proxy.split('/')[0]));
      if (!sameEmail(email, callerEmail)) {
        response = json(403, { error: 'You can only rename your own account' });
      } else {
        const { newUsername } = JSON.parse(body || '{}');
        const username = cleanUsername(newUsername);
        if (!username || username !== String(newUsername).trim()) {
          response = json(400, { error: USERNAME_RULE });
        } else if (await isUsernameTaken(dynamodb, process.env.USERS_TABLE, username, email)) {
          response = json(409, { error: 'That username is taken' });
        } else {
          await dynamodb.send(new UpdateCommand({
            TableName: process.env.USERS_TABLE,
            Key: { email },
            UpdateExpression: 'SET username = :username',
            ConditionExpression: 'attribute_exists(email)',
            ExpressionAttributeValues: { ':username': username }
          }));
          response = json(200, { message: 'Updated', username });
        }
      }
    }
    // Edit own profile: tagline, favorite books, private profile
    else if (httpMethod === 'PUT' && action === 'profile') {
      if (!isSelf) {
        response = json(403, { error: 'You can only edit your own profile' });
      } else {
        const updates = JSON.parse(body || '{}');
        const sets = [];
        const values = {};
        if (updates.tagline !== undefined) {
          const tagline = String(updates.tagline || '').trim();
          if (tagline.length > MAX_TAGLINE) {
            response = json(400, { error: `Tagline must be ${MAX_TAGLINE} characters or less` });
          }
          sets.push('tagline = :tagline');
          values[':tagline'] = tagline;
        }
        if (updates.favoriteBooks !== undefined) {
          if (!Array.isArray(updates.favoriteBooks) || updates.favoriteBooks.length > MAX_FAVORITES) {
            response = json(400, { error: `Choose up to ${MAX_FAVORITES} favorite books` });
          } else {
            sets.push('favoriteBooks = :favorites');
            values[':favorites'] = updates.favoriteBooks.filter(b => b && b.isbn && b.title).map(cleanBookCard);
          }
        }
        if (updates.isPrivate !== undefined) {
          sets.push('isPrivate = :isPrivate');
          values[':isPrivate'] = !!updates.isPrivate;
        }
        if (!response) {
          if (!sets.length) {
            response = json(400, { error: 'Nothing to update' });
          } else {
            sets.push('updatedAt = :now');
            values[':now'] = new Date().toISOString();
            const result = await dynamodb.send(new UpdateCommand({
              TableName: process.env.USERS_TABLE,
              Key: { email: targetEmail },
              UpdateExpression: 'SET ' + sets.join(', '),
              ConditionExpression: 'attribute_exists(email)',
              ExpressionAttributeValues: values,
              ReturnValues: 'ALL_NEW'
            }));
            response = json(200, { profile: result.Attributes });
          }
        }
      }
    }
    // Upload own avatar (resized in the browser; validated here)
    else if (httpMethod === 'POST' && action === 'avatar') {
      if (!isSelf) {
        response = json(403, { error: 'You can only change your own photo' });
      } else if (!AVATAR_BUCKET) {
        response = json(503, { error: 'Photo uploads are not set up yet' });
      } else {
        const { imageData } = JSON.parse(body || '{}');
        const match = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(imageData || '');
        const buffer = match ? Buffer.from(match[1], 'base64') : null;
        const image = buffer && sniffImage(buffer);
        if (!image) {
          response = json(400, { error: 'Upload a JPEG, PNG or WebP image' });
        } else if (buffer.length > MAX_AVATAR_BYTES) {
          response = json(400, { error: 'That image is too large (1 MB max)' });
        } else {
          const user = await getUser(targetEmail);
          if (!user?.userId) {
            return finish(json(404, { error: 'Profile not found' }));
          }
          const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
          const key = `avatars/${user.userId}/${Date.now()}.${image.ext}`;
          await s3Client().send(new PutObjectCommand({
            Bucket: AVATAR_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: image.type,
            CacheControl: 'public, max-age=31536000, immutable'
          }));
          const avatarUrl = avatarBaseUrl() + key;
          await dynamodb.send(new UpdateCommand({
            TableName: process.env.USERS_TABLE,
            Key: { email: targetEmail },
            UpdateExpression: 'SET avatarUrl = :url, updatedAt = :now',
            ExpressionAttributeValues: { ':url': avatarUrl, ':now': new Date().toISOString() }
          }));
          // Remove the previous photo
          if (user.avatarUrl && user.avatarUrl.startsWith(avatarBaseUrl() + `avatars/${user.userId}/`)) {
            try {
              await s3Client().send(new DeleteObjectCommand({ Bucket: AVATAR_BUCKET, Key: user.avatarUrl.slice(avatarBaseUrl().length) }));
            } catch (error) {
              console.error('Could not delete old avatar:', error);
            }
          }
          response = json(200, { avatarUrl });
        }
      }
    }
    // Grant / revoke admin (super admin only)
    else if (httpMethod === 'PUT' && isAdminFlag) {
      const email = emailKey(decodeURIComponent(proxy.split('/')[0]));
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

  return finish(response);
};
