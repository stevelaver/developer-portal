'use script';

const async = require('async');
const awsSetup = require('./aws-setup');
const fs = require('fs');
const yaml = require('yamljs');

const env = {
  SERVICE_NAME: process.env.SERVICE_NAME,
  REGION: process.env.REGION,
  STAGE: process.env.STAGE,
  SES_EMAIL_FROM: process.env.SES_EMAIL_FROM,
  RDS_PASSWORD: process.env.RDS_PASSWORD,
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
    env.RDS_DATABASE = process.env.SERVICE_NAME.replace(/\W/g, '');
    env.RDS_USER = env.RDS_DATABASE;
    awsSetup.createRds(
      process.env.REGION,
      env.RDS_DATABASE,
      process.env.RDS_PASSWORD,
      process.env.RDS_INSTANCE_CLASS,
      (err, endpoint) => {
        if (err) {
          cb(err);
        }
        env.RDS_HOST = endpoint.Address;
        env.RDS_PORT = endpoint.Port;
        env.RDS_SSL = 'Amazon SSL';
        cb();
      }
    );
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
    fs.writeFile('../env.yml', yaml.stringify(env), err => cb(err));
  },
], (err) => {
  if (err) {
    console.error(err);
  }
  process.exit();
});
