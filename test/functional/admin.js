'use strict';

import Identity from '../../lib/identity';

require('dotenv').config({ path: '.env-test', silent: true });
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const expect = require('unexpected');
const mysql = require('mysql');
const request = require('request');

const env = require('../../lib/env').load();

const rds = mysql.createConnection({
  host: env.RDS_HOST,
  port: env.RDS_PORT,
  user: env.RDS_USER,
  password: env.RDS_PASSWORD,
  database: env.RDS_DATABASE,
  ssl: 'Amazon RDS',
  multipleStatements: true,
});

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

  it('Approve User', (done) => {
    async.waterfall([
      (cb) => {
        cognito.adminDisableUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, err => cb(err));
      },
      (cb) => {
        // List unapproved users
        request.get({
          url: `${env.API_ENDPOINT}/admin/users?filter=disabled`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(_.map(res.body, item => item.email), 'to contain', userEmail);
          cb();
        });
      },
      (cb) => {
        // Enable
        request.post({
          url: `${env.API_ENDPOINT}/admin/users/${userEmail}/enable`,
          headers: {
            Authorization: token,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        // List unapproved apps without the approved one
        request.get({
          url: `${env.API_ENDPOINT}/admin/users?filter=enabled`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(_.map(res.body, item => item.email), 'to contain', userEmail);
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
