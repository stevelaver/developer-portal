'use strict';

import Identity from '../../lib/identity';
import Vendor from '../../app/vendor';

const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const expect = require('unexpected');
const fs = require('fs');
const moment = require('moment');
const mysql = require('mysql');
const Promise = require('bluebird');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

const db = require('../../lib/db');
const env = require('../../lib/env').load();
const error = require('../../lib/error');

aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
const rds = mysql.createConnection({
  host: process.env.UNIT_RDS_HOST,
  port: process.env.UNIT_RDS_PORT,
  user: process.env.UNIT_RDS_USER,
  password: process.env.UNIT_RDS_PASSWORD,
  database: process.env.UNIT_RDS_DATABASE,
  ssl: false,
  multipleStatements: true,
});

class Email {
  send(to, subject, header, content, buttonUrl = null, buttonText = null) {
    return null;
  }
}

const appEnv = _.clone(env);
appEnv.RDS_HOST = process.env.UNIT_RDS_HOST;
appEnv.RDS_PORT = process.env.UNIT_RDS_PORT;
appEnv.RDS_USER = process.env.UNIT_RDS_USER;
appEnv.RDS_PASSWORD = process.env.UNIT_RDS_PASSWORD;
appEnv.RDS_DATABASE = process.env.UNIT_RDS_DATABASE;
appEnv.RDS_SSL = false;
const vendorApp = new Vendor(db, appEnv, error);
vendorApp.setEmail(Email);

const vendor = `v${Date.now()}`;
const userEmail = `u${Date.now()}@test.com`;
const userPassword = 'uiOU.-jfdksfj88';

const createUser = () =>
  cognito.signUp({
    ClientId: env.COGNITO_CLIENT_ID,
    Username: userEmail,
    Password: userPassword,
    UserAttributes: [
      {
        Name: 'email',
        Value: userEmail,
      },
      {
        Name: 'name',
        Value: 'Test',
      },
      {
        Name: 'profile',
        Value: 'vendor1',
      },
    ],
  }).promise();

const deleteUser = () =>
  cognito.adminDeleteUser({ UserPoolId: env.COGNITO_POOL_ID, Username: userEmail }).promise();

describe('Vendor App', () => {
  before(() =>
    rds.queryAsync('DELETE FROM invitations WHERE vendor=?', [vendor])
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?, isApproved=?',
        [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0, 1],
      ))
      .then(() => createUser()));

  it('Send Invitation', () =>
    vendorApp.invite(vendor, userEmail, { name: 'User', email: process.env.FUNC_USER_EMAIL, vendors: [vendor] })
      .then(() => rds.queryAsync('SELECT * FROM invitations WHERE vendor=? AND email=?', [vendor, userEmail]))
      .then((data) => {
        expect(data, 'to have length', 1);
        expect(data[0], 'to have key', 'vendor');
        expect(data[0].vendor, 'to be', vendor);
        expect(data[0], 'to have key', 'email');
        expect(data[0].email, 'to be', userEmail);
      }));

  it('Accept Invitation fails, user does not exist', () => {
    const code = `c${Date.now()}`;
    return rds.queryAsync('INSERT INTO invitations SET code=?, vendor=?, email=?', [code, vendor, userEmail])
      .then(() => expect(vendorApp.acceptInvitation(vendor, 'test@test.com', code), 'to be rejected'));
  });

  it('Accept Invitation fails, expired', () => {
    const code = `c${Date.now()}`;
    return rds.queryAsync('INSERT INTO invitations SET code=?, vendor=?, email=?', [code, vendor, userEmail])
      .then(() => rds.queryAsync(
        'UPDATE invitations SET createdOn=? WHERE code=?',
        [moment().subtract(25, 'hours').format('YYYY-MM-DD HH:mm:ss'), code]
      ))
      .then(() => expect(vendorApp.acceptInvitation(vendor, userEmail, code), 'to be rejected'));
  });

  it('Accept Invitation success', () => {
    const code = `c${Date.now()}`;
    return rds.queryAsync('INSERT INTO invitations SET code=?, vendor=?, email=?', [code, vendor, userEmail])
      .then(() => vendorApp.acceptInvitation(vendor, userEmail, code))
      .then(() => rds.queryAsync('SELECT * FROM invitations WHERE code=?', [code]))
      .then((data) => {
        expect(data, 'to have length', 1);
        expect(data[0], 'to have key', 'acceptedOn');
        expect(data[0].acceptedOn, 'not to be null');
      })
      .then(() => cognito.adminGetUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: userEmail,
      }).promise()
      .then(data => Identity.formatUser(data)))
      .then((data) => {
        expect(data.vendors, 'to contain', vendor)
      });
  });

  after(() =>
    rds.queryAsync('DELETE FROM invitations WHERE vendor=?', [vendor])
      .then(() => rds.queryAsync('DELETE FROM vendors WHERE id=?', [vendor]))
      .then(() => deleteUser()));
});
