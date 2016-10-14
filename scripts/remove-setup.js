'use strict';

const async = require('async');
const awsSetup = require('./aws-setup');
const yaml = require('yamljs');

const env = yaml.load(`${__dirname}/../env.yml`);

async.waterfall([
  (cb) => {
    awsSetup.saveAccountId(cb);
  },
  (accountId, cb) => {
    awsSetup.deleteCognitoPool(
      env.REGION,
      env.COGNITO_POOL_ID,
      cb
    );
  },
], (err) => {
  if (err) {
    console.error(err);
  }
  process.exit();
});
