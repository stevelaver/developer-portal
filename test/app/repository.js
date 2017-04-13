'use strict';

import { registryRequest } from 'simple-docker-registry-client';
import Repository from '../../app/repository';
import Services from '../Services';

require('longjohn');
const _ = require('lodash');
const aws = require('aws-sdk');
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');
const expect = require('unexpected');
const mysql = require('mysql');
const Promise = require('bluebird');

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

const appEnv = _.clone(env);
appEnv.RDS_HOST = process.env.UNIT_RDS_HOST;
appEnv.RDS_PORT = process.env.UNIT_RDS_PORT;
appEnv.RDS_USER = process.env.UNIT_RDS_USER;
appEnv.RDS_PASSWORD = process.env.UNIT_RDS_PASSWORD;
appEnv.RDS_DATABASE = process.env.UNIT_RDS_DATABASE;
appEnv.RDS_SSL = false;
const repositoryApp = new Repository(Services, db, appEnv, error);
const ecr = new aws.ECR({ region: appEnv.REGION });

const vendorId = `v${Date.now()}`;
const appId = `app${Date.now()}`;
const repositoryName = repositoryApp.getRepositoryName(appId);
const user = { email: process.env.FUNC_USER_EMAIL, vendors: [vendorId] };

describe('Repository App', () => {
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

  const repositoryName2 = repositoryApp.getRepositoryName(`app2${Date.now()}`);
  it('Get repository credentials', () =>
      ecr.createRepository({ repositoryName: repositoryName2 }).promise()
        .then(() => repositoryApp.getCredentials(appId, vendorId, user))
        .then(creds => registryRequest(`${repositoryName}/tags/list`, creds)
          .then((res) => {
            expect(res, 'to have key', 'tags');
          })
          .then(() => registryRequest(`${repositoryName2}/tags/list`, creds))
          .then((res) => {
            expect(res, 'to have key', 'errors');
            expect(res.errors, 'to have length', 1);
            expect(res.errors[0], 'to have key', 'code');
            expect(res.errors[0].code, 'to be', 'DENIED');
          }))
        .then(() => ecr.describeRepositories({ repositoryNames: [repositoryName] }).promise())
        .then((data) => {
          expect(data, 'to have key', 'repositories');
          expect(data.repositories, 'to have length', 1);
        })
        .then(() => rds.queryAsync('SELECT * FROM `apps` WHERE id=?', [appId]))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].repoType, 'to be', 'provisioned');
          expect(data[0].repoUri, 'to be', `${repositoryApp.getRegistryName()}/${repositoryApp.getRepositoryName()}`);
        })
        .then(() => ecr.deleteRepository({ repositoryName: repositoryName2, force: true }).promise()));

  after(() =>
    ecr.deleteRepository({ repositoryName, force: true }).promise());
});
