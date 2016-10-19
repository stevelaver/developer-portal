'use strict';

const awsSetup = require('./aws-setup');
const yaml = require('yamljs');

const env = yaml.load(`${__dirname}/../env.yml`);
awsSetup.accountId = env.ACCOUNT_ID;

const done = function (err) {
  if (err) {
    throw err;
  }
  process.exit();
};

const args = process.argv.slice(2);
if (args[0] === 'delete-cognito') {
  awsSetup.deleteCognitoPool(
    env.REGION,
    env.COGNITO_POOL_ID,
    err => done(err)
  );
} else if (args[0] === 'delete-logs') {
  awsSetup.deleteLogs(
    env.REGION,
    env.SERVICE_NAME,
    env.STAGE,
    err => done(err)
  );
} else {
  console.warn('No valid arguments');
  process.exit();
}
