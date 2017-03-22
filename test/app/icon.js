'use strict';

import Icon from '../../app/icon';

require('longjohn');
const _ = require('lodash');
const aws = require('aws-sdk');
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');
const expect = require('unexpected');
const mysql = require('mysql');
const Promise = require('bluebird');
const readFile = Promise.promisify(require('fs').readFile);
const sharp = require('sharp');
const wait = require('wait-promise');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

const db = require('../../lib/db');
const env = require('../../lib/env').load();
const error = require('../../lib/error');

let rds;
const dbConnectParams = {
  driver: 'mysql',
  host: process.env.UNIT_RDS_HOST,
  port: process.env.UNIT_RDS_PORT,
  user: process.env.UNIT_RDS_USER,
  password: process.env.UNIT_RDS_PASSWORD,
  database: process.env.UNIT_RDS_DATABASE,
  ssl: process.env.UNIT_RDS_SSL,
  multipleStatements: true,
};
aws.config.setPromisesDependency(Promise);
const s3 = new aws.S3();

const appEnv = _.clone(env);
appEnv.RDS_HOST = process.env.UNIT_RDS_HOST;
appEnv.RDS_PORT = process.env.UNIT_RDS_PORT;
appEnv.RDS_USER = process.env.UNIT_RDS_USER;
appEnv.RDS_PASSWORD = process.env.UNIT_RDS_PASSWORD;
appEnv.RDS_DATABASE = process.env.UNIT_RDS_DATABASE;
appEnv.RDS_SSL = false;
const iconApp = new Icon(s3, db, appEnv, error);

const vendorId = `v${Date.now()}`;
const appId = `app${Date.now()}`;
const sourceKey = `icons/app${Date.now()}/test.png`;

describe('Icon App', () => {
  before(() => {
    const dbm = dbMigrate.getInstance(true, {
      config: {
        defaultEnv: 'current',
        current: dbConnectParams,
      },
    });

    return dbm.up()
      .then(() => {
        rds = mysql.createConnection(dbConnectParams);
      })
      .then(() => db.init(rds))
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        [vendorId, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
      ))
      .then(() => rds.queryAsync(
        'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
        [appId, vendorId, 'test1']
      ));
  });

  it('Upload icon', () =>
    readFile(`${__dirname}/../icon.png`)
      .then(data => s3.upload({ Bucket: appEnv.S3_BUCKET, Key: sourceKey, Body: data }).promise())
      .then(() => wait.sleep(3000))
      .then(() => iconApp.upload(sharp, appId, appEnv.S3_BUCKET, sourceKey))
      .then(() => expect(
        s3.headObject({ Bucket: appEnv.S3_BUCKET, Key: `icons/${appId}/32/2.png` }).promise(),
        'to be fulfilled'
      ))
      .then(() => expect(
        s3.headObject({ Bucket: appEnv.S3_BUCKET, Key: `icons/${appId}/64/2.png` }).promise(),
        'to be fulfilled'
      )));

  after(() =>
    s3.deleteObject({ Bucket: appEnv.S3_BUCKET, Key: `icons/${appId}/latest.png` }).promise()
      .then(() => s3.deleteObject({ Bucket: appEnv.S3_BUCKET, Key: `icons/${appId}/32/2.png` }).promise())
      .then(() => s3.deleteObject({ Bucket: appEnv.S3_BUCKET, Key: `icons/${appId}/64/2.png` }).promise())
      .then(() => s3.deleteObject({ Bucket: appEnv.S3_BUCKET, Key: `icons/${appId}/32` }).promise())
      .then(() => s3.deleteObject({ Bucket: appEnv.S3_BUCKET, Key: `icons/${appId}/64` }).promise())
      .then(() => s3.deleteObject({ Bucket: appEnv.S3_BUCKET, Key: `icons/${appId}` }).promise()));
});
