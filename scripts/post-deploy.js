'use script';

const async = require('async');
const awsSetup = require('./aws-setup');
const yaml = require('yamljs');

const env = yaml.load('../env.yml');

async.waterfall([
  (cb) => {
    awsSetup.saveAccountId(cb);
  },
  (cb) => {
    awsSetup.updateCognitoPool(
      env.REGION,
      env.COGNITO_POOL_ID,
      env.SERVICE_NAME,
      env.STAGE,
      cb
    );
  },
  (cb) => {
    awsSetup.subscribeLogs(
      env.REGION,
      env.SERVICE_NAME,
      env.STAGE,
      cb
    );
  },
], (err) => {
  if (err) {
    console.error(err);
  }
  process.exit();
});
