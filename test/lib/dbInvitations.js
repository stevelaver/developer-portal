'use strict';

import DbInvitations from '../../lib/db/dbInvitations';

require('longjohn');
const db = require('../../lib/db');
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');
const error = require('../../lib/error');
const expect = require('unexpected');
const mysql = require('mysql');
const Promise = require('bluebird');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

let rds;
let dbInvitations;

const dbConnectParams = {
  host: process.env.UNIT_RDS_HOST,
  port: process.env.UNIT_RDS_PORT,
  user: process.env.UNIT_RDS_USER,
  password: process.env.UNIT_RDS_PASSWORD,
  database: process.env.UNIT_RDS_DATABASE,
  ssl: process.env.UNIT_RDS_SSL,
  multipleStatements: true,
};

describe('dbInvitations', () => {
  before(() => {
    const dbm = dbMigrate.getInstance(true, {
      config: {
        defaultEnv: 'current',
        current: {
          driver: 'mysql',
          user: process.env.UNIT_RDS_USER,
          password: process.env.UNIT_RDS_PASSWORD,
          host: process.env.UNIT_RDS_HOST,
          database: process.env.UNIT_RDS_DATABASE,
          port: process.env.UNIT_RDS_PORT,
          ssl: process.env.UNIT_RDS_SSL,
          multipleStatements: true,
        },
      },
    });

    return dbm.up()
      .then(() => {
        rds = mysql.createConnection(dbConnectParams);
      })
      .then(() => db.init(rds))
      .then(() => {
        dbInvitations = new DbInvitations(rds, error);
      });
  });

  beforeEach(() =>
    rds.queryAsync('SET FOREIGN_KEY_CHECKS=0;')
      .then(() => rds.queryAsync('TRUNCATE TABLE `invitations`;'))
      .then(() => rds.queryAsync('TRUNCATE TABLE `vendors`;'))
      .then(() => rds.queryAsync('SET FOREIGN_KEY_CHECKS=1;'))
  );

  it('create', () => {
    let code;
    let firstCreatedOn;
    return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', ['vendor'])
      .then(() => dbInvitations.create('vendor', 'email', 'createdBy'))
      .then((res) => {
        expect(res, 'not to be empty');
        code = res;
        return rds.queryAsync('SELECT * FROM invitations WHERE code=?', [code]);
      })
      // Invitation exists
      .then((res) => {
        expect(res, 'to have length', 1);
        expect(res[0].vendor, 'to be', 'vendor');
        expect(res[0].email, 'to be', 'email');
        expect(res[0].createdBy, 'to be', 'createdBy');
        firstCreatedOn = res[0].createdOn;
      })
      .then(() => dbInvitations.create('vendor', 'email', 'createdBy'))
      // The previous invitation was used
      .then((res) => {
        expect(res, 'not to be empty');
        expect(res, 'to be', code);
      })
      // But validity was shifted
      .then(() => rds.queryAsync('SELECT * FROM invitations WHERE code=?', [code]))
      .then((res) => {
        expect(res, 'to have length', 1);
        expect(res[0].createdOn, 'not to be', firstCreatedOn);
      });
  });

  it('get', () => {
    const code = Date.now();
    return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', ['vendor'])
      .then(() => rds.queryAsync(
        'INSERT INTO `invitations` SET code=?, vendor=?, email=?, createdBy=?;',
        [code, 'vendor', 'email', 'createdBy']
      ))
      .then(() => dbInvitations.get(code))
      .then((data) => {
        expect(data, 'to have key', 'vendor');
        expect(data.vendor, 'to be', 'vendor');
      });
  });
});
