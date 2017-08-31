'use strict';

import Identity from '../../lib/Identity';
import Services from '../services';
import Vendor from '../../app/vendor';

const _ = require('lodash');
const aws = require('aws-sdk');
const expect = require('unexpected');
const generator = require('generate-password');
const moment = require('moment');
const mysql = require('mysql');
const Promise = require('bluebird');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

const db = require('../../lib/db');
const error = require('../../lib/error');

aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({ region: process.env.REGION });
let rds;

const appEnv = _.clone(process.env);
appEnv.RDS_HOST = process.env.UNIT_RDS_HOST;
appEnv.RDS_PORT = process.env.UNIT_RDS_PORT;
appEnv.RDS_USER = process.env.UNIT_RDS_USER;
appEnv.RDS_PASSWORD = process.env.UNIT_RDS_PASSWORD;
appEnv.RDS_DATABASE = process.env.UNIT_RDS_DATABASE;
appEnv.RDS_SSL = false;
const services = new Services(appEnv);
const vendorApp = new Vendor(services, db, appEnv, error);
let userPool;

const vendor = `v${Date.now()}`;
const userEmail = `test${Date.now()}@keboola.com`;
const userPassword = 'uiOU.-jfdksfj88';

const createUser = () =>
  cognito.signUp({
    ClientId: process.env.COGNITO_CLIENT_ID,
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
  cognito.adminDeleteUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: userEmail }).promise();

describe('Vendor App', () => {
  before(() => {
    rds = mysql.createConnection({
      host: process.env.UNIT_RDS_HOST,
      port: process.env.UNIT_RDS_PORT,
      user: process.env.UNIT_RDS_USER,
      password: process.env.UNIT_RDS_PASSWORD,
      database: process.env.UNIT_RDS_DATABASE,
      ssl: false,
      multipleStatements: true,
    });
    return rds.queryAsync('DELETE FROM invitations WHERE vendor=?', [vendor])
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
      ))
      .then(() => createUser());
  });

  beforeEach(() => {
    rds = mysql.createConnection({
      host: process.env.UNIT_RDS_HOST,
      port: process.env.UNIT_RDS_PORT,
      user: process.env.UNIT_RDS_USER,
      password: process.env.UNIT_RDS_PASSWORD,
      database: process.env.UNIT_RDS_DATABASE,
      ssl: false,
      multipleStatements: true,
    });
    return db.init(rds)
      .then(() => {
        userPool = services.getUserPool();
      });
  });

  describe('Create and Update', () => {
    const v1 = `v1${Math.random()}`;
    it('Create', () =>
      vendorApp.create({
        id: v1,
        name: 'test1',
        address: 'address1',
        email: 'email1@email.com',
      })
        .then((res) => {
          expect(res, 'to have key', 'id');
          expect(res, 'to have key', 'name');
          expect(res, 'to have key', 'address');
          expect(res, 'to have key', 'email');
        })
        .then(() => rds.queryAsync('SELECT * FROM vendors WHERE id=?', [v1]))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'name');
          expect(data[0].name, 'to be', 'test1');
          expect(data[0], 'to have key', 'email');
          expect(data[0].email, 'to be', 'email1@email.com');
          expect(data[0], 'to have key', 'address');
          expect(data[0].address, 'to be', 'address1');
        }));

    const v2 = `v2${Math.random()}`;
    it('Update', () =>
      rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        [v2, 'vendor2', 'address2', 'email2@email.com', 0],
      )
        .then(() => vendorApp.updateVendor(v2, {
          name: 'test2',
          address: 'address23',
          email: 'email23@email.com',
        }, { isAdmin: true }))
        .then((res) => {
          expect(res, 'to have key', 'id');
          expect(res, 'to have key', 'name');
          expect(res, 'to have key', 'address');
          expect(res, 'to have key', 'email');
        })
        .then(() => rds.queryAsync('SELECT * FROM vendors WHERE id=?', [v2]))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'name');
          expect(data[0].name, 'to be', 'test2');
          expect(data[0], 'to have key', 'email');
          expect(data[0].email, 'to be', 'email23@email.com');
          expect(data[0], 'to have key', 'address');
          expect(data[0].address, 'to be', 'address23');
        }));
  });

  describe('Send invitation', () => {
    it('Send', () =>
      vendorApp.invite(vendor, userEmail, { name: 'User', email: process.env.FUNC_USER_EMAIL, vendors: [vendor] })
        .then(() => rds.queryAsync('SELECT * FROM invitations WHERE vendor=? AND email=?', [vendor, userEmail]))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'vendor');
          expect(data[0].vendor, 'to be', vendor);
          expect(data[0], 'to have key', 'email');
          expect(data[0].email, 'to be', userEmail);
        }));
  });

  describe('Accept invitation', () => {
    it('Fail, user does not exist', () => {
      const code = `c${Date.now()}`;
      return rds.queryAsync('INSERT INTO invitations SET code=?, vendor=?, email=?', [code, vendor, userEmail])
        .then(() => expect(vendorApp.acceptInvitation(vendor, 'test@test.com', code), 'to be rejected'));
    });

    it('Fail, expired', () => {
      const code = `c${Date.now()}`;
      return rds.queryAsync('INSERT INTO invitations SET code=?, vendor=?, email=?', [code, vendor, userEmail])
        .then(() => rds.queryAsync(
          'UPDATE invitations SET createdOn=? WHERE code=?',
          [moment().subtract(25, 'hours').format('YYYY-MM-DD HH:mm:ss'), code]
        ))
        .then(() => expect(vendorApp.acceptInvitation(vendor, userEmail, code), 'to be rejected'));
    });

    it('Success', () => {
      const code = `c${Date.now()}`;
      return rds.queryAsync('INSERT INTO invitations SET code=?, vendor=?, email=?', [code, vendor, userEmail])
        .then(() => rds.queryAsync('INSERT INTO users SET id=?, name=?', [userEmail, 'Test']))
        .then(() => vendorApp.acceptInvitation(vendor, userEmail, code))
        .then(() => rds.queryAsync('SELECT * FROM invitations WHERE code=?', [code]))
        .then((data) => {
          expect(data, 'to have length', 1);
          expect(data[0], 'to have key', 'acceptedOn');
          expect(data[0].acceptedOn, 'not to be null');
        })
        .then(() => cognito.adminGetUser({
          UserPoolId: process.env.COGNITO_POOL_ID,
          Username: userEmail,
        }).promise())
        .then(data => Identity.formatUser(data))
        .then((data) => {
          expect(data.vendors, 'to contain', vendor);
        });
    });
  });

  describe('Remove user', () => {
    it('User is not member of vendor', () =>
      expect(
        vendorApp.removeUser(
          process.env.FUNC_VENDOR,
          userEmail,
          { name: 'User', email: process.env.FUNC_USER_EMAIL, vendors: [process.env.FUNC_VENDOR] }
        ),
        'to be rejected',
      ));
    it('Success', () =>
      userPool.addUserToVendor(userEmail, vendor)
        .catch(() => {})
        .then(() => expect(vendorApp.removeUser(
          vendor,
          userEmail,
          { name: 'User', email: process.env.FUNC_USER_EMAIL, vendors: [vendor] }
        ), 'to be fulfilled'))
        .then(() => userPool.getUser(userEmail))
        .then((data) => {
          expect(data.vendors, 'not to contain', vendor);
        }));
  });

  describe('Create service user', () => {
    let password;
    let username;
    let username2;
    it('Create', () =>
      vendorApp.createServiceUser(vendor, 'user1', 'description', { vendors: [vendor] }, generator)
        .then((data) => {
          expect(data, 'to have key', 'username');
          expect(data, 'to have key', 'password');
          username = data.username;
          password = data.password;
          return userPool.login(data.username, data.password);
        })
        .then((data) => {
          expect(data, 'to have key', 'token');
        })
        .then(() => vendorApp.createServiceUser(vendor, 'user2', 'description', { vendors: [vendor] }, generator))
        .then((data) => {
          expect(data, 'to have key', 'username');
          expect(data, 'to have key', 'password');
          expect(data.username, 'not to be', username);
          expect(data.password, 'not to be', password);
          username2 = data.username;
          return expect(userPool.login(data.username, data.password), 'to be fulfilled');
        })
        .then(() => expect(userPool.login(`service.${vendor}`, password), 'to be rejected'))
        .then(() => userPool.deleteUser(username))
        .then(() => expect(vendorApp.removeUser(
          vendor,
          username2,
          { name: 'User', email: process.env.FUNC_USER_EMAIL, vendors: [vendor] }
        ), 'to be fulfilled'))
        .then(() => expect(() => userPool.getUser(username2), 'to error')));
  });

  after(() =>
    rds.queryAsync('DELETE FROM invitations WHERE vendor=?', [vendor])
      .then(() => rds.queryAsync('DELETE FROM vendors WHERE id=?', [vendor]))
      .then(() => deleteUser()));
});
