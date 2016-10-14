'use script';

const async = require('async');
const awsSetup = require('./aws-setup');
const fs = require('fs');
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
  (cb) => {
    awsSetup.registerCloudFront(
      env.REGION,
      env.SERVICE_NAME,
      env.S3_BUCKET,
      (err, res) => {
        if (err) {
          cb(err);
        }
        env.CLOUDFRONT_ID = res.id;
        env.CLOUDFRONT_URI = res.uri;
        cb();
      }
    );
  },
  (cb) => {
    fs.writeFile(`${__dirname}/../env.yml`, yaml.stringify(env), err => cb(err));
  },
], (err) => {
  if (err) {
    console.error(err);
  }
  process.exit();
});
