'use strict';

import Identity from '../../lib/identity';

const async = require('async');
const aws = require('aws-sdk');
const expect = require('unexpected');
const mysql = require('mysql');
const request = require('request');

const env = require('../../lib/env').load();

const rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST ? process.env.FUNC_RDS_HOST : env.RDS_HOST,
  port: process.env.FUNC_RDS_PORT ? process.env.FUNC_RDS_PORT : env.RDS_PORT,
  user: env.RDS_USER,
  password: env.RDS_PASSWORD,
  database: env.RDS_DATABASE,
  ssl: env.RDS_SSL,
  multipleStatements: true,
});

const cognito = new aws.CognitoIdentityServiceProvider({ region: env.REGION });

const userEmail = `u${Date.now()}@keboola.com`;
const vendor = process.env.FUNC_VENDOR;
const vendor1 = `T.vendor.${Date.now()}`;
let token;

describe('Vendors', () => {
  before((done) => {
    async.waterfall([
      (cb) => {
        cognito.adminUpdateUserAttributes({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: process.env.FUNC_USER_EMAIL,
          UserAttributes: [
            {
              Name: 'profile',
              Value: vendor,
            },
          ],
        }, err => cb(err));
      },
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
          [vendor1, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
          err => cb(err)
        );
      },
    ], done);
  });

  it('Invite User', (done) => {
    async.waterfall([
      (cb) => {
        // 1) Signup
        request.post({
          url: `${env.API_ENDPOINT}/auth/signup`,
          json: true,
          body: {
            email: userEmail,
            password: 'uiOU.-jfdksfj88',
            name: 'Test',
            vendor: vendor1,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        // 2) Invite
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/invitations/${userEmail}`,
          headers: {
            Authorization: token,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        // 3) Check existence in db and get code
        rds.query('SELECT * FROM `invitations` WHERE vendor=? AND email=?', [vendor, userEmail], (err, res) => {
          expect(res, 'to have length', 1);
          cb(null, res[0].code);
        });
      },
      (code, cb) => {
        // 4) Accept invitation
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/invitations/${userEmail}/${code}`,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          cb();
        });
      },
      (cb) => {
        // 5) Check vendor in cognito
        cognito.adminGetUser({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: userEmail,
        }, (err, res) => cb(err, res));
      },
      (data, cb) => {
        Identity.formatUser(data)
          .then((uData) => {
            expect(uData.vendors, 'to contain', vendor);
            expect(uData.vendors, 'to contain', vendor1);
          })
          .then(() => cb())
          .catch(err => cb(err));
      },
    ], done);
  });

  after((done) => {
    async.waterfall([
      (cb) => {
        rds.query('DELETE FROM `invitations` WHERE vendor=? AND email=?', [vendor, userEmail], () => cb());
      },
      (cb) => {
        cognito.adminDeleteUser(
          { UserPoolId: env.COGNITO_POOL_ID, Username: userEmail },
          () => cb()
        );
      },
      (cb) => {
        cognito.adminUpdateUserAttributes({
          UserPoolId: env.COGNITO_POOL_ID,
          Username: process.env.FUNC_USER_EMAIL,
          UserAttributes: [
            {
              Name: 'profile',
              Value: vendor,
            },
          ],
        }, err => cb(err));
      },
    ], done);
  });
});
