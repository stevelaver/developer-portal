'use strict';

import App from '../../app/app';
import Services from '../services';

require('longjohn');
const _ = require('lodash');
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');
const expect = require('unexpected');
const mysql = require('mysql');
const Promise = require('bluebird');
const moment = require('moment');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

const db = require('../../lib/db');

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

const appEnv = _.clone(process.env);
appEnv.RDS_HOST = process.env.UNIT_RDS_HOST;
appEnv.RDS_PORT = process.env.UNIT_RDS_PORT;
appEnv.RDS_USER = process.env.UNIT_RDS_USER;
appEnv.RDS_PASSWORD = process.env.UNIT_RDS_PASSWORD;
appEnv.RDS_DATABASE = process.env.UNIT_RDS_DATABASE;
appEnv.RDS_SSL = false;
const app = new App(Services, db, appEnv);

const vendorId = `v${Date.now()}`;
const appName = `app${Date.now()}`;
const appId = `${vendorId}.${appName}`;
const appName2 = `app2${Date.now()}`;
const appId2 = `${vendorId}.${appName2}`;
const user = { email: 'test', vendors: [vendorId] };

describe('App', () => {
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
      .then(() => rds.queryAsync('INSERT IGNORE INTO `apps` SET id=?, vendor=?, name=?, isPublic=1', ['test', vendorId, 'test']));
  });

  it('Create, get and Delete', () =>
    app.createApp({ id: appName, name: 'test' }, vendorId, user)
      .then((data) => {
        expect(data, 'to have key', 'id');
        expect(data.id, 'to be', appId);
        expect(data, 'to have key', 'vendor');
        expect(data.vendor, 'to have key', 'id');
        expect(data.vendor.id, 'to be', vendorId);
        expect(data, 'to have key', 'version');
        expect(data.version, 'to be', 1);
        expect(data, 'to have key', 'deletedOn');
        expect(data.deletedOn, 'to be null');
      })
      .then(() => app.getAppForVendor(appId, vendorId, user))
      .then((data) => {
        expect(data, 'to have key', 'id');
        expect(data.id, 'to be', appId);
        expect(data, 'to have key', 'vendor');
        expect(data.vendor, 'to have key', 'id');
        expect(data.vendor.id, 'to be', vendorId);
        expect(data, 'to have key', 'version');
        expect(data.version, 'to be', 1);
        expect(data, 'to have key', 'deletedOn');
        expect(data.deletedOn, 'to be null');
      })
      .then(() => app.publicListApps())
      .then(data => expect(data, 'to have items satisfying', (item) => {
        expect(item.id, 'not to be', appId);
      }))
      .then(() => app.updateApp(appId, vendorId, { isPublic: true }, user))
      .then((data) => {
        expect(data, 'to have key', 'id');
        expect(data.id, 'to be', appId);
        expect(data, 'to have key', 'vendor');
        expect(data.vendor, 'to have key', 'id');
        expect(data.vendor.id, 'to be', vendorId);
        expect(data, 'to have key', 'version');
        expect(data.version, 'to be', 2);
        expect(data, 'to have key', 'deletedOn');
        expect(data.deletedOn, 'to be null');
      })
      .then(() => app.publicListApps())
      .then(data => expect(data, 'to have an item satisfying', (item) => {
        expect(item.id, 'to be', appId);
      }))
      .then(() => app.deleteApp(appId, vendorId, user, moment))
      .then(() => app.getAppForVendor(appId, vendorId, user))
      .then((data) => {
        expect(data.deletedOn, 'not to be null');
      })
      .then(() => app.publicListApps())
      .then(data => expect(data, 'to have items satisfying', (item) => {
        expect(item.id, 'not to be', appId);
      })));

  it('Deprecate', () =>
    app.createApp({ id: appName2, name: 'test' }, vendorId, user)
      .then(() => app.updateApp(appId2, vendorId, { isPublic: true }, user))
      .then(() => expect(app.deprecate(appId2, vendorId, user, '2017-01-01', 'test'), 'to be fulfilled'))
      .then(() => app.getAppForVendor(appId2, vendorId, user))
      .then((data) => {
        expect(data.isDeprecated, 'to be', true);
        expect(data.isPublic, 'to be', false);
        expect(data.replacementApp, 'to be', 'test');
        expect(data.expiredOn.toISOString(), 'to be', (new Date('2017-01-01')).toISOString());
      })
      .then(() => app.deleteApp(appId2, vendorId, user, moment)));
});
