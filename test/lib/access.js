'use strict';

import Access from '../../lib/access';

const db = require('../../lib/db');
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');
const error = require('../../lib/error');
const expect = require('unexpected');
const mysql = require('mysql');

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
let rds;

require('dotenv').config({ path: '.env-test', silent: true });

describe('Access', () => {
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
      .then(() => db.init(rds));
  });

  it('checkVendor', () => {
    const access = new Access(db, error);
    return expect(access.checkVendor({ vendors: ['v1', 'vendor'] }, 'vendor'), 'to be fulfilled')
      .then(() => expect(access.checkVendor({ vendors: ['v1'], isAdmin: true }, 'vendor'), 'to be fulfilled'))
      .then(() => expect(access.checkVendor({ vendors: ['v1', 'v2'] }, 'vendor'), 'to be rejected'));
  });

  const appId = Math.random();
  const appId2 = Math.random();
  it('checkApp', () =>
    rds.queryAsync(
      'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
      ['test', 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
    )
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        ['test2', 'test2', 'test2', process.env.FUNC_USER_EMAIL, 0],
      ))
      .then(() => rds.queryAsync(
        'INSERT INTO `apps` SET id=?, vendor=?, name=?',
        [appId, 'test', 'test1']
      ))
      .then(() => rds.queryAsync(
        'INSERT INTO `apps` SET id=?, vendor=?, name=?',
        [appId2, 'test2', 'test2']
      ))
      .then(() => {
        const access = new Access(db, error);
        return expect(access.checkApp({ vendors: ['v1', 'vendor'] }, 'test', appId), 'to be rejected')
          .then(() => expect(access.checkApp({ vendors: ['v1', 'test'] }, 'test2', appId), 'to be rejected'))
          .then(() => expect(access.checkApp({ vendors: ['v1', 'test'] }, 'test', appId), 'to be fulfilled'))
          .then(() => expect(access.checkApp({ vendors: ['v1'], isAdmin: true }, 'test', appId), 'to be fulfilled'));
      }));
});
