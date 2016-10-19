'use strict';

const awsSetup = require('./aws-setup');
const execsql = require('../lib/execsql');
const fs = require('fs');
const mysql = require('mysql');
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
if (args[0] === 'update-cognito') {
  awsSetup.updateCognitoPool(
    env.REGION,
    env.COGNITO_POOL_ID,
    env.SERVICE_NAME,
    env.STAGE,
    err => done(err)
  );
} else if (args[0] === 'save-cloudformation-output') {
  awsSetup.getCloudFormationOutput(
    env.REGION,
    env.SERVICE_NAME,
    env.STAGE,
    (err, res) => {
      if (err) {
        throw err;
      }
      env.RDS_HOST = res.RdsUri;
      env.RDS_PORT = res.RdsPort;
      env.CLOUDFRONT_URI = res.CloudFrontUri;
      env.API_ENDPOINT = res.ServiceEndpoint;
      fs.writeFile(
        `${__dirname}/../env.yml`,
        yaml.stringify(env),
        err2 => done(err2)
      );
    }
  );
} else if (args[0] === 'init-database') {
  execsql.execFile(mysql.createConnection({
    host: env.RDS_HOST,
    port: env.RDS_PORT,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    multipleStatements: true,
  }), `${__dirname}/../rds-model.sql`, err => done(err));
} else if (args[0] === 'subscribe-logs') {
  awsSetup.subscribeLogs(
    env.REGION,
    env.SERVICE_NAME,
    env.STAGE,
    err => done(err)
  );
} else {
  console.warn('No valid arguments');
  process.exit();
}
