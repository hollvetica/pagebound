// createUserProfile Lambda Function
// This triggers when a new user signs up via Cognito Post Confirmation trigger

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const ses = new SESClient({});

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const email = event.request.userAttributes.email;
  const userId = event.request.userAttributes.sub; // Cognito immutable user ID
  const username = event.request.userAttributes['custom:username'] || email.split('@')[0];

  // Determine if this is the super admin
  const isAdmin = email === 'hollie.tanner@gmail.com';

  try {
    // Create user profile in DynamoDB
    await dynamodb.send(new PutCommand({
      TableName: process.env.USERS_TABLE,
      Item: {
        email: email,
        userId: userId,
        username: username,
        displayName: username,
        bio: '',
        avatarUrl: null,
        isPrivate: false,
        isAdmin: isAdmin,
        createdAt: new Date().toISOString(),
        friendsCount: 0,
        publicShelves: []
      }
    }));

    // Send welcome email
    await ses.send(new SendEmailCommand({
      Source: 'noreply@pagebound.com', // Replace with your verified email
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: {
          Data: 'Welcome to Pagebound! 📚'
        },
        Body: {
          Html: {
            Data: `
              <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #6b46c1;">Welcome to Pagebound, ${username}!</h1>
                  <p>We're thrilled to have you join our community of readers.</p>
                  
                  <h2>Getting Started:</h2>
                  <ul>
                    <li>📖 Add books to your library</li>
                    <li>👥 Connect with friends</li>
                    <li>📚 Create reading sessions to stay in sync</li>
                    <li>💬 Discuss books without spoilers</li>
                  </ul>
                  
                  <p>Choose your theme and start your reading journey!</p>
                  
                  <p style="margin-top: 30px; color: #666;">
                    Happy reading,<br>
                    The Pagebound Team
                  </p>
                </body>
              </html>
            `
          },
          Text: {
            Data: `Welcome to Pagebound, ${username}!\n\nGetting Started:\n- Add books to your library\n- Connect with friends\n- Create reading sessions to stay in sync\n- Discuss books without spoilers\n\nHappy reading!`
          }
        }
      }
    }));

    console.log('User profile created and welcome email sent successfully');
  } catch (error) {
    console.error('Error:', error);
  }

  // Always return event to allow signup to complete
  return event;
};
