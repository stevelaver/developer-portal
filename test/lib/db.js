'use strict';

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
      .then(() => db.init(rds));
  });

  beforeEach(() =>
    rds.queryAsync('SET FOREIGN_KEY_CHECKS=0;')
    .then(() => rds.queryAsync('TRUNCATE TABLE `appVersions`;'))
    .then(() => rds.queryAsync('TRUNCATE TABLE `apps`;'))
    .then(() => rds.queryAsync('TRUNCATE TABLE `vendors`;'))
    .then(() => rds.queryAsync('SET FOREIGN_KEY_CHECKS=1;'))
  );

  describe('format', () => {
    it('formatAppInput', () => {
      const input = {
        uiOptions: ['1', '2'],
        testConfiguration: { one: 'two' },
        configurationSchema: { three: 'four' },
        actions: ['action'],
      };
      return db.formatAppInput(input)
        .then((res) => {
          expect(res, 'to have key', 'uiOptions');
          expect(res, 'to have key', 'testConfiguration');
          expect(res, 'to have key', 'configurationSchema');
          expect(res, 'to have key', 'actions');
          expect(res.uiOptions, 'to be', '["1","2"]');
          expect(res.testConfiguration, 'to be', '{"one":"two"}');
          expect(res.configurationSchema, 'to be', '{"three":"four"}');
          expect(res.actions, 'to be', '["action"]');
        });
    });

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
        isApproved: 1,
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
      expect(res, 'to have key', 'isApproved');
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
      expect(res.isApproved, 'to be', true);
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

  describe('checkAppCanBePublished', () => {
    const vendor = `vcacbp-${Date.now()}`;
    const app1 = `cacbp1-${Date.now()}`;
    const app2 = `cacbp2-${Date.now()}`;
    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?', [app1, vendor, 'test', 1]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?', [app2, vendor, 'test', 0]))
    );

    it('Can be published', () =>
      expect(db.checkAppCanBePublished(app1), 'to be fulfilled')
    );

    it('Cannot be published', () =>
      expect(db.checkAppCanBePublished(app2), 'to be rejected')
    );
  });

  describe('insertApp', () => {
    it('Insert new app', () => {
      const appId = `aia-${Date.now()}`;
      const vendor = `via-${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => db.insertApp({ id: appId, vendor, name: 'test', type: 'extractor' }))
        .then(() => rds.queryAsync('SELECT * FROM `apps` WHERE id=?', appId))
        .then(data => expect(data, 'to have length', 1))
        .then(() => rds.queryAsync('SELECT * FROM `appVersions` WHERE id=?', appId))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].version, 'to be', 1);
        });
    });

    it('Insert already existing app', () => {
      const appId = `aae-${Date.now()}`;
      const vendor = `vae-${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor)
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => expect(db.insertApp({ id: appId, vendor, name: 'test', type: 'extractor' }), 'to be rejected'));
    });
  });

  describe('copyAppToVersion', () => {
    it('Copy app to version', () => {
      const appId = `aia-${Date.now()}`;
      const vendor = `via-${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('SELECT * FROM `appVersions` WHERE id=?', appId))
        .then((data) => {
          expect(data, 'to have length', 0);
        })
        .then(() => rds.queryAsync(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?, repoOptions=?',
          [appId, vendor, 'test', JSON.stringify({ test: 'ok' })]
        ))
        .then(() => expect(db.copyAppToVersion(appId, 'user'), 'to be fulfilled'))
        .then(() => rds.queryAsync('SELECT * FROM `appVersions` WHERE id=?', appId))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].version, 'to be', 1);
          expect(data[0].name, 'to be', 'test');
          expect(JSON.parse(data[0].repoOptions), 'to equal', { test: 'ok' });
        });
    });
  });

  describe('updateApp', () => {
    it('Update existing app', () => {
      const appId = `aua-${Date.now()}`;
      const vendor = `vua-${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 1, 'test']))
        .then(() => expect(db.updateApp({ name: 'New name' }, appId), 'to be fulfilled'))
        .then(() => rds.queryAsync('SELECT * FROM `apps` WHERE id=?', appId))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].version, 'to be', 2);
          expect(data[0].name, 'to be', 'New name');
        })
        .then(() => rds.queryAsync('SELECT * FROM `appVersions` WHERE id=? AND version=?', [appId, 2]))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].name, 'to be', 'New name');
        });
    });
  });

  describe('addAppIcon', () => {
    it('Add icon', () => {
      const appId = `a-addAppIcon-${Date.now()}`;
      const vendor = `v-addAppIcon-${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 1, 'test']))
        .then(() => db.addAppIcon(appId))
        .then(() => rds.queryAsync('SELECT * FROM `apps` WHERE id=? AND version=2', appId))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].icon32, 'to be', `${appId}/32/2.png`);
          expect(data[0].icon64, 'to be', `${appId}/64/2.png`);
        })
        .then(() => rds.queryAsync('SELECT * FROM `appVersions` WHERE id=? AND version=2', appId))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].icon32, 'to be', `${appId}/32/2.png`);
          expect(data[0].icon64, 'to be', `${appId}/64/2.png`);
        });
    });
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
    const appId = `alaa-${Date.now()}`;
    const appId2 = `alaa2-${Date.now()}`;
    const vendor = `vlaa-${Date.now()}`;
    const vendor2 = `vlaa2-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor2]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?', [appId, vendor, 'test', 1]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?', [`alafv2-${Date.now()}`, vendor2, 'test', 1]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?', [appId2, vendor, 'test', 0]))
    );

    it('List all', () =>
      db.listApps()
        .then((data) => {
          expect(data, 'to have length', 3);
          expect(data[0], 'to have key', 'id');
          expect(data[1], 'to have key', 'id');
          expect([data[0].id, data[1].id], 'to contain', appId);
          expect([data[0].id, data[1].id], 'to contain', appId2);
        })
    );

    it('List filtered', () =>
      db.listApps('unapproved')
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'id');
          expect(data[0].id, 'to be', appId2);
        })
    );

    it('List limited', () =>
      db.listApps(null, 0, 1)
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'id');
          expect(data[0].id, 'to contain', appId);
        })
        .then(() => db.listApps(null, 1, 2))
        .then((data) => {
          expect(data, 'to have length', 2);
          expect(data[0], 'to have key', 'id');
          expect(data[1], 'to have key', 'id');
          expect([data[0].id, data[1].id], 'not to contain', appId);
          expect([data[0].id, data[1].id], 'to contain', appId2);
        })
    );
  });

  describe('listPublishedApps', () => {
    const appId = `alaa-${Date.now()}`;
    const appId2 = `alaa2-${Date.now()}`;
    const vendor = `vlaa-${Date.now()}`;
    const vendor2 = `vlaa2-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor2]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?, isPublic=?', [appId, vendor, 'test', 1, 1]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?, isPublic=?', [`alafv2-${Date.now()}`, vendor2, 'test', 1, 0]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?, isPublic=?', [`alafv3-${Date.now()}`, vendor, 'test', 0, 1]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?, isPublic=?', [appId2, vendor, 'test', 1, 1]))
    );

    it('List all', () =>
      db.listPublishedApps()
        .then((data) => {
          expect(data, 'to have length', 2);
          expect(data[0], 'to have key', 'id');
          expect(data[1], 'to have key', 'id');
          expect([data[0].id, data[1].id], 'to contain', appId);
          expect([data[0].id, data[1].id], 'to contain', appId2);
        })
    );

    it('List limited', () =>
      db.listPublishedApps(0, 1)
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'id');
          expect(data[0].id, 'to be', appId);
        })
        .then(() => db.listPublishedApps(1, 2))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'id');
          expect(data[0].id, 'to be', appId2);
        })
    );
  });

  describe('listAppsForVendor', () => {
    const appId = `alafv-${Date.now()}`;
    const appId2 = `alafv2-${Date.now()}`;
    const vendor = `vlafv-${Date.now()}`;
    const vendor2 = `vlafv2-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor2]))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [`alafv2-${Date.now()}`, vendor2, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId2, vendor, 'test']))
    );

    it('List all', () =>
      db.listAppsForVendor(vendor)
        .then((data) => {
          expect(data, 'to have length', 2);
          expect(data[0], 'to have key', 'id');
          expect([data[0].id, data[1].id], 'to contain', appId);
          expect([data[0].id, data[1].id], 'to contain', appId2);
        })
    );

    it('List limited', () =>
      db.listAppsForVendor(vendor, 0, 1)
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'id');
          expect(data[0].id, 'to contain', appId);
        })
        .then(() => db.listAppsForVendor(vendor, 1, 1))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'id');
          expect(data[0].id, 'to contain', appId2);
        })
    );
  });

  describe('getAppWithVendor', () => {
    const appId = `alafv-${Date.now()}`;
    const vendor = `vlafv-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?, version=?', [appId, vendor, 'test2', 2]))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 1, 'test1']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 2, 'test2']))
    );

    it('Get last version', () =>
      db.getAppWithVendor(appId, null, false, false)
        .then((data) => {
          expect(data, 'to have key', 'name');
          expect(data.name, 'to be', 'test2');
          expect(data, 'not to have key', 'permissions');
          expect(data, 'to have key', 'vendor');
          expect(data.vendor, 'to have key', 'name');
          expect(data.vendor.name, 'to be', 'test');
        })
    );

    it('Get version', () =>
      db.getAppWithVendor(appId, 1, false, false)
        .then((data) => {
          expect(data, 'to have key', 'name');
          expect(data.name, 'to be', 'test1');
          expect(data, 'not to have key', 'permissions');
          expect(data, 'to have key', 'vendor');
          expect(data.vendor, 'to have key', 'name');
          expect(data.vendor.name, 'to be', 'test');
        })
    );

    it('Get public', () =>
      expect(db.getAppWithVendor(appId, 1, true, false), 'to be rejected')
        .then(() => rds.queryAsync('UPDATE `apps` SET isPublic=1, isApproved=1 WHERE id=?', [appId]))
        .then(() => expect(db.getAppWithVendor(appId, 1, true, false), 'to be fulfilled'))
    );

    it('Get for admin', () =>
      db.getAppWithVendor(appId, null, false, true)
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

  describe('createVendor', () => {
    it('Create', () => {
      const vendor = `vcv-${Date.now()}`;

      return expect(db.createVendor({ id: vendor, name: 'v1', address: 'add1', email: 'email1' }), 'to be fulfilled')
        .then(() => rds.queryAsync('SELECT * FROM `vendors` WHERE id=?', vendor))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].name, 'to be', 'v1');
          expect(data[0].address, 'to be', 'add1');
          expect(data[0].email, 'to be', 'email1');
        });
    });
  });

  describe('getVendor', () => {
    const vendor1 = `vgv-${Date.now()}`;

    beforeEach(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test1", address="test2", email="test3";', vendor1)
    );

    it('Get', () =>
      db.getVendor(vendor1)
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

  describe('listVendors', () => {
    const vendor1 = `vlv1-${Date.now()}`;
    const vendor2 = `vlv2-${Date.now()}`;

    beforeEach(() =>
     rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor1)
       .then(() => rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor2))
    );

    it('List all', () =>
      db.listVendors()
        .then((data) => {
          expect(data, 'to have length', 2);
        })
    );

    it('List limited', () =>
      db.listVendors(1, 1)
        .then((data) => {
          expect(data, 'to have length', 1);
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
