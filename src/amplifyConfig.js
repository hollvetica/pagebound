// amplifyConfig.js - AWS Amplify Configuration

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-2_qPCehehzb',
      userPoolClientId: '99f53ml95fgv8ur6ils9v6j17',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true
      }
    }
  }
};

export default amplifyConfig;