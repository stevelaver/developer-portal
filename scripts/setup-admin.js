'use strict';

const _ = require('lodash');
const aws = require('aws-sdk');
const yaml = require('yamljs');

const env = yaml.load(`${__dirname}/../env.yml`);

const args = process.argv.slice(2);
if (args.length !== 2 || !_.includes(['enable', 'disable'], args[1])) {
  console.error('Must have two arguments, email and "enable"/"disable"');
}
const provider = new aws.CognitoIdentityServiceProvider({
  region: env.REGION,
});
provider.adminUpdateUserAttributes({
  UserPoolId: env.COGNITO_POOL_ID,
  Username: args[0],
  UserAttributes: [
    {
      Name: 'custom:isAdmin',
      Value: args[1] === 'enable' ? '1' : '0',
    },
  ],
}, (err) => {
  if (err) {
    throw err;
  }
  process.exit();
});
