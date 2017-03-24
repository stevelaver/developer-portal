'use strict';

import Services from '../Services';
import Identity from '../../lib/identity';

const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const expect = require('unexpected');
const moment = require('moment');
const mysql = require('mysql');
const request = require('request');
const db = require('../../lib/db');
const env = require('../../lib/env').load();

const services = new Services(env);
const userPool = services.getUserPool();

const rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST,
  port: process.env.FUNC_RDS_PORT,
  user: process.env.FUNC_RDS_USER,
  password: process.env.FUNC_RDS_PASSWORD,
  database: process.env.FUNC_RDS_DATABASE,
  ssl: process.env.FUNC_RDS_SSL,
  multipleStatements: true,
});
db.init(rds);

const cognito = new aws.CognitoIdentityServiceProvider({
  region: env.REGION,
});
const vendor = process.env.FUNC_VENDOR;
const otherVendor = `${vendor}o1`;
const appId = `app_admin_${Date.now()}`;
const userEmail = `u${Date.now()}.test@keboola.com`;
let token;

describe('Admin', () => {
  before((done) => {
    async.waterfall([
      (cb) => {
        request.post({
          url: `${env.API_ENDPOINT}/auth/login`,
          json: true,
          body: {
            email: process.env.FUNC_USER_EMAIL,
            password: process.env.FUNC_USER_PASSWORD,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'token');
          token = res.body.token;
          cb();
        });
      },
      (cb) => {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
          [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
          err => cb(err)
        );
      },
      (cb) => {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
          [otherVendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
          err => cb(err)
        );
      },
      (cb) => {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          vendor,
          err => cb(err)
        );
      },
      (cb) => {
        cognito.signUp({
          ClientId: env.COGNITO_CLIENT_ID,
          Username: userEmail,
          Password: '123jfsklJFKLAD._.d-X',
          UserAttributes: [
            { Name: 'email', Value: userEmail },
            { Name: 'name', Value: 'Test' },
            { Name: 'profile', Value: 'test' },
          ],
        }, err => cb(err));
      },
      (cb) => {
        cognito.adminConfirmSignUp({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, err => cb(err));
      },
    ], done);
  });

  it('Create and Edit App', (done) => {
    const appId2 = `${otherVendor}.${appId}-2`;
    async.waterfall([
      (cb) => {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
          [otherVendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
          err => cb(err)
        );
      },
      (cb) => {
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${otherVendor}/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: `${appId}-2`,
            name: 'test',
            type: 'extractor',
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
          cb();
        });
      },
      (cb) => {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps/${appId2}`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'forwardToken');
          expect(res.body.forwardToken, 'to be false');
          cb();
        });
      },
      (cb) => {
        // Update app
        request.patch({
          url: `${env.API_ENDPOINT}/admin/apps/${appId2}`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            forwardToken: true,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps/${appId2}`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'forwardToken');
          expect(res.body.forwardToken, 'to be true');
          cb();
        });
      },
      (cb) => {
        // Get apps changes
        request.get({
          url: `${env.API_ENDPOINT}/admin/changes?since=${moment().subtract(5, 'minutes').format('YYYY-MM-DD')}`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body.length, 'to be greater than or equal to', 2);
          expect(res.body, 'to have an item satisfying', (item) => {
            expect(item.id, 'to be', appId2);
          });
          cb();
        });
      },
    ], done);
  });

  it('Approve App', (done) => {
    async.waterfall([
      (cb) => {
        rds.query(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?',
          [appId, vendor, 'test'],
          err => cb(err)
        );
      },
      (cb) => {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps/${appId}`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'id');
          expect(res.body.id, 'to be', appId);
          cb();
        });
      },
      (cb) => {
        // List unapproved apps
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps?filter=unapproved`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(_.map(res.body, app => app.id), 'to contain', appId);
          cb();
        });
      },
      (cb) => {
        // Approve
        request.post({
          url: `${env.API_ENDPOINT}/admin/apps/${appId}/approve`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        // List unapproved apps without the approved one
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps?filter=unapproved`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(_.map(res.body, app => app.id), 'not to contain', appId);
          cb();
        });
      },
    ], done);
  });

  it('Make User Admin', (done) => {
    async.waterfall([
      (cb) => {
        cognito.adminGetUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, cb);
      },
      (user, cb) => {
        let userIsAdmin = false;
        _.each(user.UserAttributes, (item) => {
          if (item.Name === 'custom:isAdmin') {
            if (item.Value) {
              userIsAdmin = true;
            }
          }
        });
        expect(userIsAdmin, 'to be false');
        cb();
      },
      (cb) => {
        // Make user admin
        request.post({
          url: `${env.API_ENDPOINT}/admin/users/${userEmail}/admin`,
          headers: {
            Authorization: token,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        cognito.adminGetUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, cb);
      },
      function (user, cb) {
        let userIsAdmin = false;
        _.each(user.UserAttributes, (item) => {
          if (item.Name === 'custom:isAdmin') {
            if (item.Value) {
              userIsAdmin = true;
            }
          }
        });
        expect(userIsAdmin, 'to be true');
        cb();
      },
    ], done);
  });

  it('Add User to a Vendor', (done) => {
    async.waterfall([
      cb =>
        cognito.adminGetUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }).promise()
          .then(data => Identity.formatUser(data))
          .then((user) => {
            expect(user, 'to have key', 'vendors');
            expect(user.vendors, 'not to contain', otherVendor);
          })
          .then(() => cb())
          .catch(err => cb(err)),
      (cb) => {
        // Add vendor
        request.post({
          url: `${env.API_ENDPOINT}/admin/users/${userEmail}/vendors/${otherVendor}`,
          headers: {
            Authorization: token,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      cb =>
        cognito.adminGetUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }).promise()
          .then(data => Identity.formatUser(data))
          .then((user) => {
            expect(user, 'to have key', 'vendors');
            expect(user.vendors, 'to contain', otherVendor);
          })
          .then(() => cb()),
    ], done);
  });

  it('Create vendor', (done) => {
    const aVendor = `${vendor}o2`;
    async.waterfall([
      (cb) => {
        request.post({
          url: `${env.API_ENDPOINT}/admin/vendors`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: aVendor,
            name: aVendor,
            address: 'test',
            email: process.env.FUNC_USER_EMAIL,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
          cb();
        });
      },
      (cb) => {
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${aVendor}`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'name');
          expect(res.body.name, 'to be', aVendor);
          cb();
        });
      },
      (cb) => {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          [aVendor],
          err => cb(err)
        );
      },
    ], done);
  });

  it('Approve vendor', (done) => {
    const vendor1 = `${vendor}av1`;
    async.waterfall([
      (cb) => {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?, isApproved=?',
          [vendor1, 'test', 'test', process.env.FUNC_USER_EMAIL, 0, 0],
          err => cb(err)
        );
      },
      (cb) => {
        request.post({
          url: `${env.API_ENDPOINT}/admin/vendors/${vendor1}/approve`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
          cb();
        });
      },
      (cb) => {
        rds.query('SELECT * FROM `vendors` WHERE id=?', [vendor1], (err, res) => cb(err, res));
      },
      (data, cb) => {
        expect(data, 'to have length', 1);
        expect(data[0], 'to have key', 'id');
        expect(data[0], 'to have key', 'isApproved');
        expect(data[0].isApproved, 'to be', 1);
        cb();
      },
      (cb) => {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          [vendor1],
          err => cb(err)
        );
      },
    ], done);
  });

  it('Approve vendor with new id', (done) => {
    const vendor1 = `av1${Date.now()}`;
    const vendor2 = `av2${Date.now()}`;
    async.waterfall([
      (cb) => {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?, isApproved=?, createdBy=?',
          [vendor1, 'test', 'test', process.env.FUNC_USER_EMAIL, 0, 0, userEmail],
          err => cb(err)
        );
      },
      cb => userPool.addUserToVendor(userEmail, vendor1)
        .then(() => cb()),
      (cb) => {
        request.post({
          url: `${env.API_ENDPOINT}/admin/vendors/${vendor1}/approve`,
          headers: {
            Authorization: token,
          },
          body: {
            newId: vendor2,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
          cb();
        });
      },
      (cb) => {
        rds.query('SELECT * FROM `vendors` WHERE id=?', [vendor1], (err, res) => cb(err, res));
      },
      (data, cb) => {
        expect(data, 'to have length', 0);
        cb();
      },
      (cb) => {
        rds.query('SELECT * FROM `vendors` WHERE id=?', [vendor2], (err, res) => cb(err, res));
      },
      (data, cb) => {
        expect(data, 'to have length', 1);
        expect(data[0], 'to have key', 'id');
        expect(data[0], 'to have key', 'isApproved');
        expect(data[0].isApproved, 'to be', 1);
        cb();
      },
      cb => userPool.getUser(userEmail)
        .then((data) => {
          expect(data.vendors, 'not to contain', vendor1);
          expect(data.vendors, 'to contain', vendor2);
          cb();
        })
        .catch(err => cb(err)),
      (cb) => {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          [vendor2],
          err => cb(err)
        );
      },
    ], done);
  });

  after((done) => {
    async.waterfall([
      (cb) => {
        rds.query(
          'DELETE FROM apps WHERE vendor=? OR vendor=?',
          [vendor, otherVendor],
          () => cb()
        );
      },
      (cb) => {
        cognito.adminDeleteUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, () => cb());
      },
    ], done);
  });
});
