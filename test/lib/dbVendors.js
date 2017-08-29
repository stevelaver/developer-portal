'use strict';

import DbVendors from '../../lib/db/dbVendors';

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
let dbVendors;

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

describe('dbVendors', () => {
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
      .then(() => {
        dbVendors = new DbVendors(rds, error);
      });
  });

  beforeEach(() =>
    rds.queryAsync('SET FOREIGN_KEY_CHECKS=0;')
      .then(() => rds.queryAsync('TRUNCATE TABLE `vendors`;'))
      .then(() => rds.queryAsync('SET FOREIGN_KEY_CHECKS=1;'))
  );

  describe('list', () => {
    const vendor1 = `vlv1-${Date.now()}`;
    const vendor2 = `vlv2-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor1)
        .then(() => rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor2))
    );

    it('List all', () =>
      dbVendors.list()
        .then((data) => {
          expect(data, 'to have length', 2);
        })
    );

    it('List limited', () =>
      dbVendors.list(1, 1)
        .then((data) => {
          expect(data, 'to have length', 1);
        })
    );
  });

  describe('get', () => {
    const vendor1 = `vgv-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test1", address="test2", email="test3";', vendor1)
    );

    it('Get', () =>
      dbVendors.get(vendor1)
        .then((res) => {
          expect(res, 'to have key', 'id');
          expect(res, 'to have key', 'name');
          expect(res, 'to have key', 'address');
          expect(res, 'to have key', 'email');
          expect(res.id, 'to be', vendor1);
          expect(res.name, 'to be', 'test1');
          expect(res.address, 'to be', 'test2');
          expect(res.email, 'to be', 'test3');
        })
    );
  });

  describe('createVendor', () => {
    it('Create', () => {
      const vendor = `vcv-${Date.now()}`;

      return expect(dbVendors.create({ id: vendor, name: 'v1', address: 'add1', email: 'email1' }), 'to be fulfilled')
        .then(() => rds.queryAsync('SELECT * FROM `vendors` WHERE id=?', vendor))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].name, 'to be', 'v1');
          expect(data[0].address, 'to be', 'add1');
          expect(data[0].email, 'to be', 'email1');
        });
    });
  });

  describe('updateVendor', () => {
    it('Update', () => {
      const vendor = `vcv-${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="v1", address="a1", email="e1";', [vendor])
        .then(() => expect(
          dbVendors.update(vendor, { id: `${vendor}2`, name: 'v2', address: 'a2', email: 'e2' }),
          'to be fulfilled')
        )
        .then(() => rds.queryAsync('SELECT * FROM `vendors` WHERE id=?', `${vendor}2`))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].name, 'to be', 'v2');
          expect(data[0].address, 'to be', 'a2');
          expect(data[0].email, 'to be', 'e2');
        });
    });
  });
});
