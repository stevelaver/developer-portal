'use strict';

require('longjohn');
const db = require('../../lib/db');
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');
const expect = require('unexpected');
const mysql = require('mysql');
const Promise = require('bluebird');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

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

describe('db', () => {
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

  beforeEach(() =>
    rds.queryAsync('SET FOREIGN_KEY_CHECKS=0;')
      .then(() => rds.queryAsync('TRUNCATE TABLE `appVersions`;'))
      .then(() => rds.queryAsync('TRUNCATE TABLE `apps`;'))
      .then(() => rds.queryAsync('TRUNCATE TABLE `vendors`;'))
      .then(() => rds.queryAsync('TRUNCATE TABLE `stacks`;'))
      .then(() => rds.queryAsync('SET FOREIGN_KEY_CHECKS=1;'))
  );

  describe('format', () => {
    it('formatAppOutput', (done) => {
      const input = {
        encryption: 1,
        defaultBucket: 0,
        forwardToken: 1,
        uiOptions: '["1","2"]',
        testConfiguration: '{"one":"two"}',
        configurationSchema: '{"three":"four"}',
        actions: '[]',
        fees: 0,
        vendorId: 'keboola',
        vendorName: 'Keboola',
        vendorAddress: 'Křižíkova 115, Praha',
        vendorEmail: 'test@test.com',
      };
      const res = db.formatAppOutput(input);
      expect(res, 'to have key', 'encryption');
      expect(res, 'to have key', 'defaultBucket');
      expect(res, 'to have key', 'forwardToken');
      expect(res, 'to have key', 'uiOptions');
      expect(res, 'to have key', 'testConfiguration');
      expect(res, 'to have key', 'configurationSchema');
      expect(res, 'to have key', 'actions');
      expect(res, 'to have key', 'fees');
      expect(res, 'to have key', 'vendor');
      expect(res.vendor, 'to have key', 'id');
      expect(res.vendor, 'to have key', 'name');
      expect(res.vendor, 'to have key', 'address');
      expect(res.vendor, 'to have key', 'email');
      expect(res, 'not to have key', 'vendorId');
      expect(res, 'not to have key', 'vendorName');
      expect(res, 'not to have key', 'vendorAddress');
      expect(res, 'not to have key', 'vendorEmail');
      expect(res.encryption, 'to be', true);
      expect(res.defaultBucket, 'to be', false);
      expect(res.forwardToken, 'to be', true);
      expect(res.uiOptions, 'to equal', ['1', '2']);
      expect(res.testConfiguration, 'to equal', { one: 'two' });
      expect(res.configurationSchema, 'to equal', { three: 'four' });
      expect(res.actions, 'to equal', []);
      expect(res.fees, 'to be', false);
      expect(res.vendor.id, 'to be', 'keboola');
      expect(res.vendor.name, 'to be', 'Keboola');
      expect(res.vendor.address, 'to be', 'Křižíkova 115, Praha');
      expect(res.vendor.email, 'to be', 'test@test.com');
      done();
    });
  });

  describe('checkAppNotExists', () => {
    const appId = `acane-${Date.now()}`;
    const vendor = `vcane-${Date.now()}`;

    it('App does not exist', () =>
      expect(db.checkAppNotExists(appId), 'to be fulfilled')
    );

    it('App exists', () =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => expect(db.checkAppNotExists(appId), 'to be rejected'))
    );
  });

  describe('checkAppAccess', () => {
    const appId = `acaa-${Date.now()}`;
    const vendor = `vcaa-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
    );

    it('Has access', () =>
      expect(db.checkAppAccess(appId, vendor), 'to be fulfilled')
    );

    it('Does not have access', () =>
      expect(db.checkAppAccess(appId, `v2-${Date.now()}`), 'to be rejected')
    );
  });

  describe('checkVendorExists', () => {
    const vendor = `vcve-${Date.now()}`;
    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
    );

    it('Exists', () =>
      expect(db.checkVendorExists(vendor), 'to be fulfilled')
    );

    it('Does not exist', () =>
      expect(db.checkVendorExists(`vx-${Date.now()}`), 'to be rejected')
    );
  });

  describe('getApp', () => {
    const appId = `aga-${Date.now()}`;
    const vendor = `vga-${Date.now()}`;

    it('Get non-existing app', () =>
      expect(db.getApp(appId), 'to be rejected')
    );

    it('Get existing app', () =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => db.getApp(appId))
        .then((data) => {
          expect(data, 'not to be null');
          expect(data, 'to have key', 'id');
          expect(data.id, 'to be', appId);
          expect(data, 'to have key', 'name');
          expect(data.name, 'to be', 'test');
        })
    );
  });

  describe('getAppVersion', () => {
    const appId = `agav-${Date.now()}`;
    const vendor = `vgav-${Date.now()}`;

    it('Get app version', () =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 2, 'test']))
        .then(() => db.getAppVersion(appId, 2))
        .then((data) => {
          expect(data, 'not to be null');
          expect(data, 'to have key', 'id');
          expect(data.id, 'to be', appId);
          expect(data, 'to have key', 'name');
          expect(data.name, 'to be', 'test');
        })
    );
  });

  describe('listApps', () => {
    const appId = `app1-${Date.now()}`;
    const appId2 = `app2-${Date.now()}`;
    const vendor = `vlaa-${Date.now()}`;
    const vendor2 = `vlaa2-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor2]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isPublic=?', [appId, vendor, 'test1', 1]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isPublic=?', [appId2, vendor, 'test2', 0]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isPublic=?', [`app3-${Date.now()}`, vendor2, 'test3', 0]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isPublic=?', [`app4-${Date.now()}`, vendor2, 'test4', 0]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isPublic=?', [`app5-${Date.now()}`, vendor, 'test5', 1]))
    );

    it('List all', () =>
      db.listApps()
        .then((data) => {
          expect(data, 'to have length', 5);
          expect(data[0], 'to have key', 'id');
          expect(data[1], 'to have key', 'id');
          expect([data[0].id, data[1].id, data[2].id, data[3].id, data[4].id], 'to contain', appId);
          expect([data[0].id, data[1].id, data[2].id, data[3].id, data[4].id], 'to contain', appId2);
        })
    );

    it('List limited', () =>
      db.listApps(null, false, 0, 1)
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'id');
          expect(data[0].id, 'to contain', appId);
        })
        .then(() => db.listApps(null, false, 1, 2))
        .then((data) => {
          expect(data, 'to have length', 2);
          expect(data[0], 'to have key', 'id');
          expect(data[1], 'to have key', 'id');
          expect([data[0].id, data[1].id], 'not to contain', appId);
          expect([data[0].id, data[1].id], 'to contain', appId2);
        })
    );

    it('List published', () =>
      db.listApps(null, true)
        .then((data) => {
          expect(data, 'to have length', 2);
          expect(data[0], 'to have key', 'id');
          expect(data[1], 'to have key', 'id');
          expect([data[0].id, data[1].id], 'to contain', appId);
          expect([data[0].id, data[1].id], 'not to contain', appId2);
        })
    );

    it('List for vendor', () =>
      db.listApps(vendor)
        .then((data) => {
          expect(data, 'to have length', 3);
          expect(data[0], 'to have key', 'id');
          expect([data[0].id, data[1].id, data[2].id], 'to contain', appId);
          expect([data[0].id, data[1].id, data[2].id], 'to contain', appId2);
        })
    );
  });

  describe('getAppWithVendor, publicGetApp', () => {
    const appId = `alafv-${Date.now()}`;
    const vendor = `vlafv-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?, version=?, isPublic=?',
          [appId, vendor, 'test2', 2, 0],
        ))
        .then(() => rds.queryAsync(
          'INSERT INTO `appVersions` SET id=?, version=?, name=?, isPublic=?',
          [appId, 1, 'test1', 0],
        ))
        .then(() => rds.queryAsync(
          'INSERT INTO `appVersions` SET id=?, version=?, name=?, isPublic=?',
          [appId, 2, 'test2', 0],
        ))
    );

    it('Get last version', () =>
      db.getAppWithVendor(appId, null, false, false)
        .then((data) => {
          expect(data, 'to have key', 'name');
          expect(data.name, 'to be', 'test2');
          expect(data, 'to have key', 'vendor');
          expect(data.vendor, 'to have key', 'name');
          expect(data.vendor.name, 'to be', 'test');
          expect(data, 'to have key', 'isDeprecated');
          expect(data, 'to have key', 'expiredOn');
          expect(data, 'to have key', 'replacementApp');
        })
    );

    it('Get version', () =>
      db.getAppWithVendor(appId, 1)
        .then((data) => {
          expect(data, 'to have key', 'name');
          expect(data.name, 'to be', 'test1');
          expect(data, 'to have key', 'vendor');
          expect(data.vendor, 'to have key', 'name');
          expect(data.vendor.name, 'to be', 'test');
          expect(data, 'to have key', 'isDeprecated');
          expect(data, 'to have key', 'expiredOn');
          expect(data, 'to have key', 'replacementApp');
        })
    );

    it('Get public', () =>
      expect(db.publicGetApp(appId), 'to be rejected')
        .then(() => rds.queryAsync('UPDATE `apps` SET isPublic=1 WHERE id=?', [appId]))
        .then(() => rds.queryAsync('UPDATE `appVersions` SET isPublic=1 WHERE id=?', [appId]))
        .then(() => expect(db.getAppWithVendor(appId, 1, true, false), 'to be fulfilled'))
    );

    it('Get for admin', () =>
      db.getAppWithVendor(appId)
        .then((data) => {
          expect(data, 'to have key', 'name');
          expect(data.name, 'to be', 'test2');
          expect(data, 'to have key', 'permissions');
          expect(data, 'to have key', 'vendor');
          expect(data.vendor, 'to have key', 'name');
          expect(data.vendor.name, 'to be', 'test');
        })
    );
  });

  describe('listVersions', () => {
    const appId = `alv-${Date.now()}`;
    const vendor = `vlv-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 1, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 2, 'test2']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 3, 'test3']))
    );

    it('List all', () =>
      db.listVersions(appId)
        .then((data) => {
          expect(data, 'to have length', 3);
          expect(data[0], 'to have key', 'id');
          expect(data[1], 'to have key', 'id');
          expect(data[2], 'to have key', 'id');
          expect(data[0].id, 'to be', appId);
          expect(data[1].id, 'to be', appId);
          expect(data[2].id, 'to be', appId);
        })
    );

    it('List limited', () =>
      db.listVersions(appId, 1, 1)
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'id');
          expect(data[0].version, 'to be', 2);
        })
    );
  });

  describe('listStacks', () => {
    const stack1 = `sls1-${Date.now()}`;
    const stack2 = `sls2-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `stacks` SET name=?', stack1)
        .then(() => rds.queryAsync('INSERT INTO `stacks` SET name=?', stack2))
    );
    it('List all', () =>
      db.listStacks()
        .then((data) => {
          expect(data, 'to have length', 2);
          expect(data, 'to contain', stack1);
          expect(data, 'to contain', stack2);
        })
    );
  });
});
