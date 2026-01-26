// amplifyConfig.js - AWS Amplify Configuration
// REPLACE VALUES WITH YOUR AWS RESOURCE IDS AFTER SETUP

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'YOUR_USER_POOL_ID', // e.g., 'us-east-1_AbCdEfGhI'
      userPoolClientId: 'YOUR_USER_POOL_CLIENT_ID', // e.g., '1a2b3c4d5e6f7g8h9i0j'
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true
      }
    }
  }
};

export default amplifyConfig;
