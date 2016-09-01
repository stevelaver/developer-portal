'use strict';
require('dotenv').config();

var async = require('async');
var aws = require('aws-sdk');
var db = require('../../vendor/db');
var execsql = require('../../execsql');
var expect = require('chai').expect;
var mysql = require('mysql');
var request = require('request');

var rds = mysql.createConnection({
  host: process.env.RDS_FUNCTIONAL_HOST,
  user: process.env.RDS_FUNCTIONAL_USER,
  password: process.env.RDS_FUNCTIONAL_PASSWORD,
  database: process.env.RDS_FUNCTIONAL_DATABASE,
  ssl: process.env.RDS_SSL ? 'Amazon RDS' : false,
  multipleStatements: true
});

const vendor = 'v' + Math.random();
const userEmail = 'e' + Math.random() + '@test.com';
const userPassword1 = 'uiOU.-jfdksfj88';
const userPassword2 = 'uiOU.-jfdksfj89';

var cognito = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});

describe('auth', function() {
  before(function(done) {
    async.waterfall([
      function(callback) {
        execsql.execFile(rds, __dirname + '/../../rds-model.sql', function(err) {
          callback(err);
        });
      },
      function(callback) {
        execsql.exec(rds, 'INSERT INTO vendors SET id="'+vendor+'", name="test", address="test", email="test";', function(err) {
          callback(err);
        });
      }
    ],
    function(err) {
      done(err);
    });
  });

  it('create user flow', function(done) {
    async.waterfall([
      function(callback) {
        // 1) Signup
        request.post({
          url: process.env.API_BASE_URI + '/auth/signup',
          json: true,
          body: {
            email: userEmail,
            password: userPassword1,
            name: 'Test',
            vendor: vendor
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.be.null;
          callback();
        });
      },
      function(callback) {
        // 2) Login without confirmation
        request.post({
          url: process.env.API_BASE_URI + '/auth/login',
          json: true,
          body: {
            email: userEmail,
            password: userPassword1
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.have.property('errorType');
          expect(body.errorType).to.equal('UserNotConfirmedException');
          callback();
        });
      },
      function(callback) {
        // 3) Resend confirmation
        request.post({
          url: process.env.API_BASE_URI + '/auth/confirm',
          json: true,
          body: {
            email: userEmail,
            password: userPassword1
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.be.null;
          callback();
        });
      },
      function(callback) {
        // 4) Confirm
        // We can't get valid code so we try with some invalid to check that function works and confirm user manually
        request.post({
          url: process.env.API_BASE_URI + '/auth/confirm/'+process.env.USER_EMAIL+'/000000'
        }, function(err, res, body) {
          expect(err).to.be.null;
          body = JSON.parse(body);
          expect(body).to.have.property('errorType');
          expect(body.errorType).to.be.oneOf(['CodeMismatchException', 'ExpiredCodeException']);
          callback();
        });
      },function(callback) {
        cognito.adminConfirmSignUp({UserPoolId: process.env.COGNITO_USER_POOL_ID, Username: userEmail}, function() {
          callback();
        });
      },
      function(callback) {
        // 5) Login
        request.post({
          url: process.env.API_BASE_URI + '/auth/login',
          json: true,
          body: {
            email: userEmail,
            password: userPassword1
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.have.property('token');
          callback(null, body.token);
        });
      },
      function(token, callback) {
        // 6) Get Profile
        request.get({
          url: process.env.API_BASE_URI + '/auth/profile',
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          body = JSON.parse(body);
          expect(body).to.have.property('vendor');
          expect(body.vendor).to.equal(vendor);
          callback(null, token);
        });
      },
      function(token, callback) {
        // 7) Change password
        request.put({
          url: process.env.API_BASE_URI + '/auth/profile',
          headers: {
            Authorization: token
          },
          json: true,
          body: {
            oldPassword: userPassword1,
            newPassword: userPassword2
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.be.null;
          callback();
        });
      },
      function(callback) {
        // 8) Login with new password
        request.post({
          url: process.env.API_BASE_URI + '/auth/login',
          json: true,
          body: {
            email: userEmail,
            password: userPassword2
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.have.property('token');
          callback();
        });
      }
    ], done);
  });

  it('forgot password flow', function(done) {
    async.waterfall([
      function (callback) {
        request.post({
          url: process.env.API_BASE_URI + '/auth/forgot',
          json: true,
          body: {
            email: process.env.USER_EMAIL
          }
        }, function (err, res, body) {
          expect(err).to.be.null;
          expect(body).to.be.null;
          callback();
        });
      },
      function (callback) {
        // Check with fake code - as we can't get real one from email so we just test if lambda function works
        request.post({
          url: process.env.API_BASE_URI + '/auth/forgot/confirm',
          json: true,
          body: {
            email: process.env.USER_EMAIL,
            password: userPassword1,
            code: '000000'
          }
        }, function (err, res, body) {
          expect(err).to.be.null;
          expect(body).to.have.property('errorType');
          expect(body.errorType).to.be.oneOf(['CodeMismatchException', 'ExpiredCodeException']);
          callback();
        });
      }
    ], done);
  });

  after(function(done) {
    async.waterfall([
      function(callback) {
        execsql.exec(rds, 'DELETE FROM vendors WHERE id="' + vendor + '";', function() {
          callback();
        });
      },
      function(callback) {
        cognito.adminDeleteUser({UserPoolId: process.env.COGNITO_USER_POOL_ID, Username: userEmail}, function() {
          // Ignore if does not exist
          callback();
        });
      }
    ], done);
  });
});