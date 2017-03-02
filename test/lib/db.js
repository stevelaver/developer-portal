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

    it('App does not exist', () => {
      return expect(db.checkAppNotExists(appId), 'to be fulfilled');
    });

    it('App exists', () => {
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => expect(db.checkAppNotExists(appId), 'to be rejected'))
    });
  });

  describe('checkAppAccess', () => {
    const appId = `acaa-${Date.now()}`;
    const vendor = `vcaa-${Date.now()}`;

    before(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
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
    before(() =>
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
    before(() =>
      rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?', [app1, vendor, 'test', 1]))
        .then(() => rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=?', [app2, vendor, 'test', 0]))
    );

    it('Can be published', () =>
      expect(db.checkAppCanBePublished(app1), 'to be fulfilled')
    );

    it('Cannot be published', () =>
      expect(db.checkAppCanBePublished(app2), 'to be rejected')
    );
  });

  /*
  describe('insertApp', () => {
    it('insert new app', (done) => {
      const appId = `a-insertApp-${Date.now()}`;
      const vendor = `v-insertApp-${Date.now()}`;

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, () => {
        db.connect(dbConnectParams);
        db.insertApp({ id: appId, vendor, name: 'test', type: 'extractor' }, () => {
          rds.query('SELECT * FROM `apps` WHERE id=?', appId, (err, res) => {
            expect(res).to.have.length(1);
            rds.query('SELECT * FROM `appVersions` WHERE id=?', appId, (err1, res1) => {
              expect(res1).to.have.length(1);
              expect(res1[0].version, 'to be', 1);
              done();
            });
          });
        });
      });
    });

    it('insert already existing app', (done) => {
      const appId = `a-alreadyExists-${Date.now()}`;
      const vendor = `v-alreadyExists-${Date.now()}`;

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'],
        (err1) => {
          if (err1) throw err1;
          db.connect(dbConnectParams);
          db.insertApp({ id: appId, vendor, name: 'test', type: 'extractor' }, (err2) => {
            expect(err2).to.not.be.empty;
            done();
          });
        });
      });
    });
  });

  describe('updateApp', () => {
    it('update existing app', (done) => {
      const appId = `a-updateApp-${Date.now()}`;
      const vendor = `v-updateApp-${Date.now()}`;

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'],
        (err1) => {
          if (err1) throw err1;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test'],
          (err2) => {
            if (err) throw err2;
            db.connect(dbConnectParams);
            db.updateApp({ name: 'New name' }, appId, 'user', () => {
              rds.query('SELECT * FROM `apps` WHERE id=? AND version=2', appId, (err3, res) => {
                if (err3) throw err3;
                expect(res).to.have.length(1);
                rds.query('SELECT * FROM `appVersions` WHERE id=? AND version=2', appId,
                (err4, res4) => {
                  if (err4) throw err4;
                  expect(res4).to.have.length(1);
                  expect(res4[0].name, 'to be', 'New name');
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('addAppIcon', () => {
    it('add app icon', (done) => {
      const appId = `a-addAppIcon-${Date.now()}`;
      const vendor = `v-addAppIcon-${Date.now()}`;

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'],
        (err1) => {
          if (err1) throw err1;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test'],
          (err2) => {
            if (err2) throw err2;
            db.connect(dbConnectParams);
            const size = 32;
            db.addAppIcon(appId, size, () => {
              rds.query('SELECT * FROM `apps` WHERE id=? AND version=2', appId, (err3, res) => {
                if (err3) throw err3;
                expect(res).to.have.length(1);
                expect(res[0].icon32, 'to be', `${appId}/${size}/2.png`);
                rds.query('SELECT * FROM appVersions WHERE id=? AND version=2', appId,
                (err4, res4) => {
                  if (err4) throw err4;
                  expect(res4).to.have.length(1);
                  expect(res4[0].icon32, 'to be', `${appId}/${size}/2.png`);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('getApp', () => {
    const appId = `a-getApp-${Date.now()}`;
    const vendor = `v-getApp-${Date.now()}`;
    before((done) => {
      db.connect(dbConnectParams);
      done();
    });

    it('get non-existing app', (done) => {
      db.getApp(appId, null, (err) => {
        expect(err).to.not.be.null;
        done();
      });
    });

    it('get existing app', (done) => {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
       vendor, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'],
        (err1) => {
          if (err1) throw err1;
          db.getApp(appId, null, (err2, res) => {
            expect(err2).to.be.null;
            expect(res, 'to have key', 'id');
            expect(res.id).to.be.equal(appId);
            done();
          });
        });
      });
    });

    it('get app version', (done) => {
      const appId1 = `a-getAppVersion-${Date.now()}`;
      const vendor1 = `v-getAppVersion-${Date.now()}`;

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor1, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId1, vendor1, 'test'],
        (err1) => {
          if (err1) throw err1;
          rds.query('INSERT INTO `appVersions` SET id=?, version=?, name=?;', [appId1, 2, 'test'],
          (err2) => {
            if (err2) throw err2;
            db.connect(dbConnectParams);
            db.getApp(appId1, 2, (err3, res) => {
              expect(err3).to.be.null;
              expect(res, 'to have key', 'id');
              expect(res.id).to.be.equal(appId1);
              done();
            });
          });
        });
      });
    });
  });

  describe('listAppsForVendor', () => {
    const appId = `a-listAppsForVendor-${Date.now()}`;
    const vendor = `v-listAppsForVendor-${Date.now()}`;
    const vendor2 = `v2-listAppsForVendor-${Date.now()}`;

    before((done) => {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="extractor";',
        [appId, vendor], (err2) => {
          if (err2) throw err2;
          rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
          vendor2, (err3) => {
            if (err3) throw err3;
            rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="extractor";',
            [`ex-${Date.now()}`, vendor2], (err4) => {
              if (err4) throw err4;
              rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="extractor";',
              [`${appId}1`, vendor], (err5) => {
                if (err5) throw err;
                db.connect(dbConnectParams);
                done();
              });
            });
          });
        });
      });
    });

    it('list all', (done) => {
      db.listAppsForVendor(vendor, null, null, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.length(2);
        expect(res[0].id).to.be.equal(appId);
        done();
      });
    });

    it('list limited', (done) => {
      db.listAppsForVendor(vendor, 1, 1, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.length(1);
        expect(res[0].id).to.be.equal(`${appId}1`);
        done();
      });
    });
  });

  describe('listVersions', () => {
    const appId = `a-listVersions-${Date.now()}`;
    const vendor = `v-listVersions-${Date.now()}`;

    before((done) => {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="extractor";',
        [appId, vendor], (err1) => {
          if (err1) throw err1;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?',
          [appId, 'test v1'], (err2) => {
            if (err2) throw err2;
            rds.query('INSERT INTO `appVersions` SET id=?, version=2, name=?',
            [appId, 'test v2'], (err3) => {
              if (err3) throw err3;
              rds.query('INSERT INTO `appVersions` SET id=?, version=3, name=?',
              [appId, 'test v3'], (err4) => {
                if (err4) throw err4;
                db.connect(dbConnectParams);
                done();
              });
            });
          });
        });
      });
    });

    it('list all versions', (done) => {
      db.listVersions(appId, null, null, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.length(3);
        expect(res[2].name).to.be.equal('test v3');
        done();
      });
    });

    it('list limited versions', (done) => {
      db.listVersions(appId, 1, 1, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.length(1);
        expect(res[0].name).to.be.equal('test v2');
        done();
      });
    });
  });

  describe('getPublishedApp', () => {
    const appId = `a-getPublishedApp-${Date.now()}`;
    const vendor = `v-getPublishedApp-${Date.now()}`;

    before((done) => {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=3, name="test", type="extractor",
        isApproved=1;', [appId, vendor], (err1) => {
          if (err1) throw err1;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test v1'],
          (err2) => {
            if (err2) throw err2;
            rds.query('INSERT INTO `appVersions` SET id=?, version=2, name=?', [appId, 'test v2'],
            (err3) => {
              if (err3) throw err3;
              rds.query('INSERT INTO `appVersions` SET id=?, version=3, name=?', [appId, 'test v3'],
              (err4) => {
                if (err4) throw err4;
                db.connect(dbConnectParams);
                done();
              });
            });
          });
        });
      });
    });

    it('get last version', (done) => {
      db.getPublishedApp(appId, null, (err, res) => {
        expect(err).to.be.null;
        expect(res, 'to have key', 'version');
        expect(res.version).to.be.equal(3);
        done();
      });
    });

    it('get specific version', (done) => {
      db.getPublishedApp(appId, 1, (err, res) => {
        expect(err).to.be.null;
        expect(res, 'to have key', 'version');
        expect(res.version).to.be.equal(1);
        done();
      });
    });

    it('do not show unpublished app', (done) => {
      const appId2 = `app2-${Date.now()}`;
      rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=3, name="test", type="extractor",
      isApproved=0;', [appId2, vendor], (err) => {
        if (err) throw err;
        db.getPublishedApp(appId2, null, (err1) => {
          expect(err1).to.not.be.null;
          done();
        });
      });
    });
  });

  describe('listPublishedApps', () => {
    const appId1 = `a1-listPublishedApps-${Date.now()}`;
    const appId2 = `a2-listPublishedApps-${Date.now()}`;
    const vendor = `v-listPublishedApps-${Date.now()}`;

    before((done) => {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=1, name="test",
        type="extractor", isApproved=1;', [appId1, vendor], (err1) => {
          if (err1) throw err1;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?',
          [appId1, 'test'], (err2) => {
            if (err2) throw err2;
            rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=1, name="test",
            type="extractor", isApproved=1;', [appId2, vendor], (err3) => {
              if (err3) throw err3;
              rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?',
              [appId2, 'test'], (err4) => {
                if (err4) throw err4;
                db.connect(dbConnectParams);
                done();
              });
            });
          });
        });
      });
    });

    it('list all', (done) => {
      db.listPublishedApps(null, null, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.length.at.least(2);
        done();
      });
    });

    it('list selected', (done) => {
      db.listPublishedApps(1, 1, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.lengthOf(1);
        done();
      });
    });
  });

  describe('listPublishedAppVersions', () => {
    const appId = `a-listPublishedAppVersions-${Date.now()}`;
    const vendor = `v-listPublishedAppVersions-${Date.now()}`;

    before((done) => {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor, (err1) => {
        if (err1) throw err1;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=1, name="test", type="extractor",
        isApproved=1;', [appId, vendor], (err2) => {
          if (err2) throw err2;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test'],
          (err3) => {
            if (err3) throw err3;
            rds.query('INSERT INTO `appVersions` SET id=?, version=2, name=?', [appId, 'test2'],
            (err4) => {
              if (err4) throw err4;
              db.connect(dbConnectParams);
              done();
            });
          });
        });
      });
    });

    it('list all', (done) => {
      db.listPublishedAppVersions(appId, null, null, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.lengthOf(2);
        expect(res[0].name, 'to be', 'test');
        expect(res[1].name, 'to be', 'test2');
        done();
      });
    });

    it('list selected', (done) => {
      db.listPublishedAppVersions(appId, 1, 1, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.lengthOf(1);
        expect(res[0].name, 'to be', 'test2');
        done();
      });
    });
  });

  describe('listVendors', () => {
    const vendor1 = `v1-listVendors-${Date.now()}`;
    const vendor2 = `v2-listVendors-${Date.now()}`;

    before((done) => {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor1, (err) => {
        if (err) throw err;
        rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
        vendor2, (err1) => {
          if (err1) throw err1;
          db.connect(dbConnectParams);
          done();
        });
      });
    });

    it('list all', (done) => {
      db.listVendors(null, null, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.length.at.least(2);
        done();
      });
    });

    it('list selected', (done) => {
      db.listVendors(1, 1, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.have.lengthOf(1);
        done();
      });
    });
  });

  describe('getVendor', () => {
    const vendor1 = `v1-getVendor-${Date.now()}`;

    before((done) => {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";',
      vendor1, (err) => {
        if (err) throw err;
        db.connect(dbConnectParams);
        done();
      });
    });

    it('get', (done) => {
      db.getVendor(vendor1, (err, res) => {
        expect(err).to.be.null;
        expect(res, 'to have key', 'id');
        expect(res, 'to have key', 'name');
        expect(res, 'to have key', 'address');
        expect(res, 'to have key', 'email');
        expect(res.id, 'to be', vendor1);
        done();
      });
    });
  });
  */
});
