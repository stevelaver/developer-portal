'use strict';

const async = require('async');
const aws = require('aws-sdk');
const expect = require('unexpected');
const mysql = require('mysql');
const request = require('request');

const env = require('../../lib/env').load();

const rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST,
  port: process.env.FUNC_RDS_PORT,
  user: process.env.FUNC_RDS_USER,
  password: process.env.FUNC_RDS_PASSWORD,
  database: process.env.FUNC_RDS_DATABASE,
  ssl: process.env.FUNC_RDS_SSL,
  multipleStatements: true,
});

const vendor = `v${Date.now()}`;
const userEmail = `u${Date.now()}@test.com`;
const userPassword1 = 'uiOU.-jfdksfj88';
const otherVendor = `${vendor}o1`;

const cognito = new aws.CognitoIdentityServiceProvider({ region: env.REGION });

describe('Auth', () => {
  before((done) => {
    async.waterfall([
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
    ], done);
  });

  it('Signup user', (done) => {
    async.waterfall([
      (cb) => {
        // 1) Signup
        request.post({
          url: `${env.API_ENDPOINT}/auth/signup`,
          json: true,
          body: {
            email: userEmail,
            password: userPassword1,
            name: 'Test',
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
          cb();
        });
      },
      (cb) => {
        // 2) Login without confirmation
        request.post({
          url: `${env.API_ENDPOINT}/auth/login`,
          json: true,
          body: {
            email: userEmail,
            password: userPassword1,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 401);
          expect(res.body, 'to have key', 'errorType');
          expect(res.body.errorType, 'to be', 'UserNotConfirmedException');
          cb();
        });
      },
      (cb) => {
        // 3) Resend confirmation
        request.post({
          url: `${env.API_ENDPOINT}/auth/confirm`,
          json: true,
          body: {
            email: userEmail,
            password: userPassword1,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        // 4) Confirm
        // We can't get valid code so we try with some invalid to check that
        // function works and confirm user manually
        request.post({
          url: `${env.API_ENDPOINT}/auth/confirm/${process.env.FUNC_USER_EMAIL}/000`,
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 404);
          expect(res.body, 'to have key', 'errorType');
          expect(res.body.errorType, 'to be one of', ['CodeMismatchException', 'ExpiredCodeException']);
          cb();
        });
      },
      (cb) => {
        cognito.adminConfirmSignUp(
          { UserPoolId: env.COGNITO_POOL_ID, Username: userEmail },
          err => cb(err)
        );
      },
      (cb) => {
        // 5) Login
        request.post({
          url: `${env.API_ENDPOINT}/auth/login`,
          json: true,
          body: {
            email: userEmail,
            password: userPassword1,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'token');
          cb(null, res.body.token);
        });
      },
      (token, cb) => {
        // 6) Get Profile
        request.get({
          url: `${env.API_ENDPOINT}/auth/profile`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'vendors');
          cb(null, token);
        });
      },
    ], done);
  });

  it('Forgot password', (done) => {
    async.waterfall([
      (cb) => {
        request.post({
          url: `${env.API_ENDPOINT}/auth/forgot/${process.env.FUNC_USER_EMAIL}`,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        // Check with fake code - as we can't get real one from email
        // so we just test if lambda function works
        request.post({
          url: `${env.API_ENDPOINT}/auth/forgot/${process.env.FUNC_USER_EMAIL}/confirm`,
          json: true,
          body: {
            password: userPassword1,
            code: '000000',
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 404);
          expect(res.body, 'to have key', 'errorType');
          expect(res.body.errorType, 'to be one of', ['CodeMismatchException', 'ExpiredCodeException']);
          cb();
        });
      },
    ], done);
  });

  it('Refresh token', (done) => {
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
          expect(res.body, 'to have key', 'refreshToken');
          cb(null, res.body.refreshToken);
        });
      },
      (token, cb) => {
        request.get({
          url: `${env.API_ENDPOINT}/auth/token`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'token');
          cb(null, res.body.token);
        });
      },
      (token, cb) => {
        request.get({
          url: `${env.API_ENDPOINT}/auth/profile`,
          headers: {
            Authorization: token,
          },
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'name');
          cb(null, token);
        });
      },
    ], done);
  });
/*
  it('MFA', (done) => {
    let token;
    async.waterfall([
      (cb) => {
        // 1) Signup
        request.post({
          url: `${env.API_ENDPOINT}/auth/signup`,
          json: true,
          body: {
            email: userEmail,
            password: userPassword1,
            name: 'Test',
            vendor,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
          cb();
        });
      },
      (cb) => {
        cognito.adminConfirmSignUp(
          { UserPoolId: env.COGNITO_POOL_ID, Username: userEmail },
          err => cb(err)
        );
      },
      (cb) => {
        // 2) Login
        request.post({
          url: `${env.API_ENDPOINT}/auth/login`,
          json: true,
          body: {
            email: userEmail,
            password: userPassword1,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'token');
          token = res.body.token;
          cb();
        });
      },
      (cb) => {
        // 3) Enable MFA
        request.post({
          url: `${env.API_ENDPOINT}/auth/mfa/+420777123456`,
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
          .then((data) => {
            expect(data, 'to have key', 'UserAttributes');
            expect(data.UserAttributes, 'to have an item satisfying', (item) => {
              expect(item.Name, 'to be', 'phone_number');
              expect(item.Value, 'to be', '+420777123456');
            });
          })
          .then(() => cb())
          .catch(err => cb(err)),
    ], done);
  });
*/
  afterEach((done) => {
    async.waterfall([
      (cb) => {
        cognito.adminDeleteUser(
          { UserPoolId: env.COGNITO_POOL_ID, Username: userEmail },
          () => cb()
        );
      },
    ], done);
  });
});
