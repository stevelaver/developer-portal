'use strict';

import DbApps from '../../lib/db/dbApps';

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
let dbApps;

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

describe('dbApps', () => {
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
        dbApps = new DbApps(rds, error);
      });
  });

  beforeEach(() =>
    rds.queryAsync('SET FOREIGN_KEY_CHECKS=0')
      .then(() => rds.queryAsync('TRUNCATE TABLE `appVersions`'))
      .then(() => rds.queryAsync('TRUNCATE TABLE `apps`'))
      .then(() => rds.queryAsync('SET FOREIGN_KEY_CHECKS=1'))
  );

  describe('insertApp', () => {
    it('Insert new app', () => {
      const appId = `insertApp-a${Date.now()}`;
      const vendor = `insertApp-v${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => dbApps.insertApp({ id: appId, vendor, name: 'test', type: 'extractor' }))
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
        .then(() => expect(dbApps.insertApp({ id: appId, vendor, name: 'test', type: 'extractor' }), 'to be rejected'));
    });
  });

  describe('addAppIcon', () => {
    it('Add icon', () => {
      const appId = `addAppIcon-a${Date.now()}`;
      const vendor = `addAppIcon-v${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 1, 'test']))
        .then(() => dbApps.addAppIcon(appId))
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

  describe('updateApp', () => {
    it('Update existing app', () => {
      const appId = `updateApp-a${Date.now()}`;
      const vendor = `updateApp-v${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test']))
        .then(() => rds.queryAsync('INSERT INTO `appVersions` SET id=?, version=?, name=?', [appId, 1, 'test']))
        .then(() => expect(dbApps.updateApp(appId, { name: 'New name' }, 'user'), 'to be fulfilled'))
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

  describe('copyAppToVersion', () => {
    it('Copy app to version', () => {
      const appId = `copyAppToVersion-a${Date.now()}`;
      const vendor = `copyAppToVersion-v${Date.now()}`;

      return rds.queryAsync('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', [vendor])
        .then(() => rds.queryAsync('SELECT * FROM `appVersions` WHERE id=?', appId))
        .then((data) => {
          expect(data, 'to have length', 0);
        })
        .then(() => rds.queryAsync(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?, repoOptions=?',
          [appId, vendor, 'test', JSON.stringify({ test: 'ok' })]
        ))
        .then(() => expect(dbApps.copyAppToVersion(appId, 'user'), 'to be fulfilled'))
        .then(() => rds.queryAsync('SELECT * FROM `appVersions` WHERE id=?', appId))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0].version, 'to be', 1);
          expect(data[0].name, 'to be', 'test');
          expect(JSON.parse(data[0].repoOptions), 'to equal', { test: 'ok' });
        });
    });
  });

  describe('formatAppInput', () => {
    it('formatAppInput', () => {
      const input = {
        uiOptions: ['1', '2'],
        testConfiguration: { one: 'two' },
        configurationSchema: { three: 'four' },
        actions: ['action'],
      };
      return dbApps.formatAppInput(input)
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
  });
});
