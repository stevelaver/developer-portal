'use script';

const _ = require('lodash');
const async = require('async');
const awsSetup = require('./aws-setup');
const env = require('../lib/env').load();
const yaml = require('yamljs');

const args = process.argv.slice(2);
if (!args.length === 2) {
  console.error('The script needs two arguments');
  process.exit(1);
}


async.waterfall([
  (cb) => {
    awsSetup.saveAccountId(cb);
  },
  (cb) => {
    const dbName = env.SERVICE_NAME.replace(/\W/g, '');
    awsSetup.createRds(env.REGION, dbName, env.RDS_PASSWORD, args[1], cb);
  },
  (cb) => {
    awsSetup.registerEmail(env.REGION, env.SES_EMAIL_FROM, cb);
  },
  (cb) => {
    const emailArn = `arn:aws:ses:${env.REGION}:${accountId}:identity/${env.SES_EMAIL_FROM}`;
    awsSetup.createCognitoPool(env.REGION, env.SERVICE_NAME, emailArn, cb);
  },
  (cb) => {
    const messageHandlerArn = `arn:aws:lambda:${env.REGION}:${accountId}:function:${env.SERVICE_NAME}-${env.STAGE}-authEmailTrigger`;
    awsSetup.updateCognitoPool(env.REGION, env.COGNITO_POOL_ID, messageHandlerArn);
    cb();
  },
], (err) => {
  if (err) {
    console.error(err);
  }
  process.exit();
});
