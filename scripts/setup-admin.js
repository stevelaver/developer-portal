'use strict';

require('longjohn');
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const yaml = require('yamljs');

const env = yaml.load(`${__dirname}/../env.yml`);

const args = process.argv.slice(2);
if (args.length !== 2 || !_.includes(['enable', 'disable'], args[1])) {
  console.error('Must have two arguments, email and "enable"/"disable"');
}
const cognito = new aws.CognitoIdentityServiceProvider({
  region: env.REGION,
});

async.waterfall([
  (cb) => {
    cognito.adminUpdateUserAttributes({
      UserPoolId: env.COGNITO_POOL_ID,
      Username: args[0],
      UserAttributes: [
        {
          Name: 'custom:isAdmin',
          Value: args[1] === 'enable' ? '1' : '0',
        },
      ],
    }, err => cb(err));
  },
  (cb) => {
    cognito.adminEnableUser({
      UserPoolId: env.COGNITO_POOL_ID,
      Username: args[0],
    }, err => cb(err));
  },
], (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.info('Done');
  }
  process.exit();
});
