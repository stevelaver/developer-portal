'use strict';

const async = require('async');
const awsSetup = require('./aws-setup');
const fs = require('fs');
const yaml = require('yamljs');

const dbName = process.env.SERVICE_NAME.replace(/\W/g, '').substr(0, 16);
const env = {
  SERVICE_NAME: process.env.SERVICE_NAME,
  REGION: process.env.REGION,
  STAGE: process.env.STAGE,
  SES_EMAIL_FROM: process.env.SES_EMAIL_FROM,
  RDS_INSTANCE_CLASS: process.env.RDS_INSTANCE_CLASS,
  RDS_DATABASE: dbName,
  RDS_USER: dbName,
  RDS_PASSWORD: process.env.RDS_PASSWORD,
  RDS_SSL: 'Amazon SSL',
  S3_BUCKET: `${process.env.SERVICE_NAME}-icons`,
};

async.waterfall([
  (cb) => {
    awsSetup.saveAccountId((err, accountId) => {
      if (err) {
        cb(err);
      }
      env.ACCOUNT_ID = accountId;
      cb();
    });
  },
  (cb) => {
    awsSetup.registerEmail(process.env.REGION, process.env.SES_EMAIL_FROM, cb);
  },
  (cb) => {
    awsSetup.createCognitoPool(
      process.env.REGION,
      process.env.SERVICE_NAME,
      process.env.SES_EMAIL_FROM,
      (err, res) => {
        if (err) {
          cb(err);
        }
        env.COGNITO_POOL_ID = res.poolId;
        env.COGNITO_CLIENT_ID = res.clientId;
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
