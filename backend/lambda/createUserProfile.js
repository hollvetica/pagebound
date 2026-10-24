// Cognito post-confirmation trigger (pagebound-post-confirmation).
//
// Creates the reader's profile when they confirm their sign-up. Cognito also
// runs this trigger after a confirmed password reset; that must never touch
// the profile, so only PostConfirmation_ConfirmSignUp is handled.
//
// Never throws: a failing trigger would stop the reader confirming their
// account. If the profile can't be created here, the user API creates it the
// first time they open the app (see profiles.js).
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { createProfileIfMissing } = require('./profiles');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  try {
    const attributes = event.request?.userAttributes || {};
    const { profile, created } = await createProfileIfMissing(dynamodb, {
      table: process.env.USERS_TABLE,
      email: attributes.email,
      userId: attributes.sub,
      wantedUsername: attributes['custom:username']
    });
    console.log(created ? 'Created profile' : 'Profile already existed', profile?.userId);
  } catch (error) {
    console.error('Could not create profile; the app will create it on first sign-in:', error);
  }

  return event;
};
