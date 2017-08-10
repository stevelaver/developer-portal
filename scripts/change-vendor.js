'use strict';

const aws = require('aws-sdk');

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Must have two arguments, email and vendor');
}
const provider = new aws.CognitoIdentityServiceProvider({
  region: process.env.REGION,
});
provider.adminUpdateUserAttributes({
  UserPoolId: process.env.COGNITO_POOL_ID,
  Username: args[0],
  UserAttributes: [
    {
      Name: 'profile',
      Value: args[1],
    },
  ],
}, (err) => {
  if (err) {
    throw err;
  }
  process.exit();
});
