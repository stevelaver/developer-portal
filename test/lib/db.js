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

  /*
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

  describe('getPublishedApp', () => {
    const appId = `a-getPublishedApp-${Date.now()}`;
    const vendor = `v-getPublishedApp-${Date.now()}`;

   beforeEach((done) => {
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

   beforeEach((done) => {
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

   beforeEach((done) => {
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

   beforeEach((done) => {
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

   beforeEach((done) => {
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
