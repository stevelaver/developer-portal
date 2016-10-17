'use strict';

const async = require('async');
const awsSetup = require('./aws-setup');
const execsql = require('../lib/execsql');
const fs = require('fs');
const mysql = require('mysql');
const yaml = require('yamljs');

const env = yaml.load(`${__dirname}/../env.yml`);

async.waterfall([
  (cb) => {
    awsSetup.saveAccountId(cb);
  },
  (accountId, cb) => {
    awsSetup.updateCognitoPool(
      env.REGION,
      env.COGNITO_POOL_ID,
      env.SERVICE_NAME,
      env.STAGE,
      cb
    );
  },
  /* (cb) => {
    awsSetup.subscribeLogs(
      env.REGION,
      env.SERVICE_NAME,
      env.STAGE,
      cb
    );
  },*/
  (cb) => {
    awsSetup.getCloudFormationOutput(
      env.REGION,
      env.SERVICE_NAME,
      env.STAGE,
      cb
    );
  },
  (data, cb) => {
    env.RDS_HOST = data.RdsUri;
    env.RDS_PORT = data.RdsPort;
    env.CLOUDFRONT_URI = data.CloudFrontUri;
    env.API_ENDPOINT = data.ServiceEndpoint;
    fs.writeFile(
      `${__dirname}/../env.yml`,
      yaml.stringify(env),
      err => cb(err)
    );
  },
  (cb) => {
    execsql.execFile(mysql.createConnection({
      host: env.RDS_HOST,
      port: env.RDS_PORT,
      user: env.RDS_USER,
      password: env.RDS_PASSWORD,
      database: env.RDS_DATABASE,
      ssl: env.RDS_SSL,
      multipleStatements: true,
    }), `${__dirname}/../rds-model.sql`, err => cb(err));
  },
], (err) => {
  if (err) {
    console.error(err);
  }
  process.exit();
});
