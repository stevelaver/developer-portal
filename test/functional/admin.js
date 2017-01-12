'use strict';

require('dotenv').config({ path: '.env-test', silent: true });
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const env = require('../../lib/env').load();
const mysql = require('mysql');
const request = require('request');

const chai = require('chai');
const dirtyChai = require('dirty-chai');

const expect = chai.expect;
chai.use(dirtyChai);

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
const otherVendor = `${vendor}-other`;
const appId = `app_admin_${Date.now()}`;
const userEmail = `u${Date.now()}.test@keboola.com`;
let token;

describe('admin', () => {
  before((done) => {
    async.waterfall([
      function (callback) {
        request.post({
          url: `${env.API_ENDPOINT}/auth/login`,
          json: true,
          body: {
            email: process.env.FUNC_USER_EMAIL,
            password: process.env.FUNC_USER_PASSWORD,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('token');
          token = body.token;
          callback();
        });
      },
      function (cb) {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
          [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
          err => cb(err)
        );
      },
      function (callback) {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          vendor,
          err => callback(err)
        );
      },
      function (cb) {
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
      function (cb) {
        cognito.adminConfirmSignUp({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, err => cb(err));
      },
    ], done);
  });

  it('Edit App', (done) => {
    const appId2 = `${appId}-2`;
    async.waterfall([
      function (cb) {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
          [otherVendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
          err => cb(err)
        );
      },
      function (cb) {
        rds.query(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?',
          [appId2, otherVendor, 'test'],
          err => cb(err)
        );
      },
      function (cb) {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps/${appId2}`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.property('forwardToken');
          expect(body.forwardToken).to.be.equal(false);
          cb();
        });
      },
      function (cb) {
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
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      function (cb) {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps/${appId2}`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.property('forwardToken');
          expect(body.forwardToken).to.be.equal(true);
          cb();
        });
      },
    ], done);
  });

  it('Approve App', (done) => {
    async.waterfall([
      function (cb) {
        rds.query(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?',
          [appId, vendor, 'test'],
          err => cb(err)
        );
      },
      function (cb) {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps/${appId}`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          expect(body.id).to.be.equal(appId);
          cb();
        });
      },
      function (cb) {
        // List unapproved apps
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps?filter=unapproved`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          let appFound = false;
          _.each(body, (item) => {
            if (item.id === appId) {
              appFound = true;
            }
          });
          expect(appFound).to.be.true();
          cb();
        });
      },
      function (cb) {
        // Approve
        request.post({
          url: `${env.API_ENDPOINT}/admin/apps/${appId}/approve`,
          headers: {
            Authorization: token,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      function (cb) {
        // List unapproved apps without the approved one
        request.get({
          url: `${env.API_ENDPOINT}/admin/apps?filter=unapproved`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          let appFound = false;
          _.each(body, (item) => {
            if (item.id === appId) {
              appFound = true;
            }
          });
          expect(appFound).to.be.false();
          cb();
        });
      },
    ], done);
  });

  it('Approve User', (done) => {
    async.waterfall([
      function (cb) {
        cognito.adminDisableUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, err => cb(err));
      },
      function (cb) {
        // List unapproved users
        request.get({
          url: `${env.API_ENDPOINT}/admin/users?filter=disabled`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          let userFound = false;
          _.each(body, (item) => {
            if (item.email === userEmail) {
              userFound = true;
            }
          });
          expect(userFound).to.be.true();
          cb();
        });
      },
      function (cb) {
        // Enable
        request.post({
          url: `${env.API_ENDPOINT}/admin/users/${userEmail}/enable`,
          headers: {
            Authorization: token,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      function (cb) {
        // List unapproved apps without the approved one
        request.get({
          url: `${env.API_ENDPOINT}/admin/users?filter=enabled`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          let userFound = false;
          _.each(body, (item) => {
            if (item.email === userEmail) {
              userFound = true;
            }
          });
          expect(userFound).to.be.true();
          cb();
        });
      },
    ], done);
  });

  it('Make User Admin', (done) => {
    async.waterfall([
      function (cb) {
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
        expect(userIsAdmin).to.be.false();
        cb();
      },
      function (cb) {
        // Make user admin
        request.post({
          url: `${env.API_ENDPOINT}/admin/users/${userEmail}/admin`,
          headers: {
            Authorization: token,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      function (cb) {
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
        expect(userIsAdmin).to.be.true();
        cb();
      },
    ], done);
  });

  after((done) => {
    async.waterfall([
      function (cb) {
        rds.query(
          'DELETE FROM apps WHERE vendor=? OR vendor=?',
          [vendor, otherVendor],
          err => cb(err)
        );
      },
      function (cb) {
        cognito.adminDeleteUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, err => cb(err));
      },
    ], done);
  });
});
