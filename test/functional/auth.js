'use strict';

require('dotenv').config({ path: '.env-test', silent: true });
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

const vendor = `v${Date.now()}`;
const userEmail = `u${Date.now()}@test.com`;
const userPassword1 = 'uiOU.-jfdksfj88';
const userPassword2 = 'uiOU.-jfdksfj89';

const cognito = new aws.CognitoIdentityServiceProvider({ region: env.REGION });

describe('auth', () => {
  before((cb) => {
    rds.query(
      'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
      [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
      err => cb(err)
    );
  });

  it('approve user flow', (done) => {
    async.waterfall([
      (cb) => {
        // 1) Signup with non-existing vendor
        request.post({
          url: `${env.API_ENDPOINT}/auth/signup`,
          json: true,
          body: {
            email: userEmail,
            password: userPassword1,
            name: 'Test',
            vendor: `T.vendor.${Date.now()}`,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorType');
          expect(body.errorType, JSON.stringify(body)).to.equal('NotFound');
          cb();
        });
      },
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
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
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
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorType');
          expect(body.errorType).to.equal('UserNotConfirmedException');
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
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      (cb) => {
        // 4) Confirm
        // We can't get valid code so we try with some invalid to check that
        // function works and confirm user manually
        request.post({
          url: `${env.API_ENDPOINT}/auth/confirm/${process.env.FUNC_USER_EMAIL}/000`,
        }, (err, res, bodyIn) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyIn);
          expect(body, JSON.stringify(body)).to.have.property('errorType');
          expect(body.errorType).to.be
            .oneOf(['CodeMismatchException', 'ExpiredCodeException']);
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
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('token');
          cb(null, body.token);
        });
      },
      (token, cb) => {
        // 6) Get Profile
        request.get({
          url: `${env.API_ENDPOINT}/auth/profile`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyIn) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyIn);
          expect(body, JSON.stringify(body)).to.have.property('vendor');
          expect(body.vendor).to.equal(vendor);
          cb(null, token);
        });
      },
      (token, cb) => {
        // 7) Change password
        request.put({
          url: `${env.API_ENDPOINT}/auth/profile`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            oldPassword: userPassword1,
            newPassword: userPassword2,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      (cb) => {
        // 8) Login with new password
        request.post({
          url: `${env.API_ENDPOINT}/auth/login`,
          json: true,
          body: {
            email: userEmail,
            password: userPassword2,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('token');
          cb();
        });
      },
    ], done);
  });

  it('forgot password flow', (done) => {
    async.waterfall([
      (cb) => {
        request.post({
          url: `${env.API_ENDPOINT}/auth/forgot/${process.env.FUNC_USER_EMAIL}`,
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
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
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorType');
          expect(body.errorType).to.be
            .oneOf(['CodeMismatchException', 'ExpiredCodeException']);
          cb();
        });
      },
    ], done);
  });

  after((done) => {
    async.waterfall([
      (cb) => {
        rds.query('DELETE FROM vendors WHERE id=?', vendor, () => cb());
      },
      (cb) => {
        cognito.adminDeleteUser(
          { UserPoolId: env.COGNITO_POOL_ID, Username: userEmail },
          () => cb()
        );
      },
    ], done);
  });
});
