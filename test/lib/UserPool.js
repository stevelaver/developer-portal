'use strict';

import Identity from '../../lib/Identity';
import UserPool from '../../lib/UserPool';

const aws = require('aws-sdk');
const expect = require('unexpected');
const mysql = require('mysql');
const Promise = require('bluebird');
const err = require('../../lib/error');
const db = require('../../lib/db');
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');

let rds;
let userPool;
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
Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({ region: process.env.REGION });
let email;

const createUser = () => {
  email = `devportal-${Date.now()}@test.keboola.com`;
  return cognito.signUp({
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: email,
    Password: 'uifsdk129JDKS_DSJ',
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
      {
        Name: 'name',
        Value: 'Test User',
      },
      {
        Name: 'profile',
        Value: 'test1,test2',
      },
    ],
  }).promise();
};

const deleteUser = () =>
  cognito.adminDeleteUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise();


describe('UserPool', () => {
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
      .then(() => rds.queryAsync('TRUNCATE TABLE `migrations`'))
      .then(() => {
        userPool = new UserPool(
          cognito,
          process.env.COGNITO_POOL_ID,
          process.env.COGNITO_CLIENT_ID,
          Identity,
          err,
        );
      });
  });

  it('getCognito', () =>
    expect(userPool.getCognito(), 'to be', cognito));

  it('getUser', () =>
    createUser()
      .then(() => userPool.getUser(email))
      .then((user) => {
        expect(user, 'to have key', 'email');
        expect(user.email, 'to be', email);
        expect(user, 'to have key', 'name');
        expect(user.name, 'to be', 'Test User');
        expect(user, 'to have key', 'isEnabled');
        expect(user.isEnabled, 'to be', true);
      })
      .then(() => deleteUser()));

  it('listUsers, listUsersForVendor', () =>
    createUser()
      .then(() => userPool.listUsers())
      .then((data) => {
        expect(data.users, 'to have an item satisfying', { email });
      })
      .then(() => userPool.listUsers('unconfirmed'))
      .then((data) => {
        expect(data.users, 'to have an item satisfying', { email });
      })
      .then(() => cognito.adminConfirmSignUp({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise())
      .then(() => userPool.listUsers('confirmed'))
      .then((data) => {
        expect(data.users, 'to have an item satisfying', { email });
      })
      .then(() => userPool.listUsers('enabled'))
      .then((data) => {
        expect(data.users, 'to have an item satisfying', { email });
      })
      .then(() => userPool.listUsersForVendor('test1'))
      .then((data) => {
        expect(data.users, 'to have an item satisfying', { email });
      })
      .then(() => userPool.listUsersForVendor('testX'))
      .then((data) => {
        expect(data.users, 'to have length', 0);
      })
      .then(() => deleteUser()));

  it('updateUserAttribute, addUserToVendor, removeUserFromVendor, makeUserAdmin', () =>
    createUser()
      .then(() => userPool.updateUserAttribute(email, 'profile', 'test'))
      .then(() => cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise())
      .then((data) => {
        expect(data, 'to have key', 'UserAttributes');
        expect(data.UserAttributes, 'to have an item satisfying', { Name: 'profile', Value: 'test' });
      })
      .then(() => userPool.addUserToVendor(email, 'test2'))
      .then(() => cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise())
      .then((data) => {
        expect(data, 'to have key', 'UserAttributes');
        expect(data.UserAttributes, 'to have an item satisfying', { Name: 'profile', Value: 'test,test2' });
      })
      .then(() => userPool.removeUserFromVendor(email, 'test2'))
      .then(() => cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise())
      .then((data) => {
        expect(data, 'to have key', 'UserAttributes');
        expect(data.UserAttributes, 'to have an item satisfying', { Name: 'profile', Value: 'test' });
      })
      .then(() => userPool.makeUserAdmin(email))
      .then(() => cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise())
      .then((data) => {
        expect(data, 'to have key', 'UserAttributes');
        expect(data.UserAttributes, 'to have an item satisfying', { Name: 'custom:isAdmin', Value: '1' });
      })
      .then(() => deleteUser()));

  it('deleteUser', () =>
    createUser()
      .then(() => expect(
        cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise(),
        'to be fulfilled'
      ))
      .then(() => userPool.deleteUser(email))
      .then(() => expect(
        cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise(),
        'to be rejected'
      )));

  it('signUp', () => {
    const email2 = `devportal-2${Date.now()}@test.keboola.com`;
    return userPool.signUp(email2, 'uifsdk129JDKS_DSJ', 'Test')
      .then(() => cognito.adminConfirmSignUp({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email2 }).promise())
      .then(() => expect(
        cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email2 }).promise(),
        'to be fulfilled',
      ))
      .then(() => cognito.adminDeleteUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email2 }).promise());
  });

  it('confirmSignUp', () =>
    createUser()
      .then(() => cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise())
      .then((data) => {
        expect(data, 'to have key', 'UserStatus');
        expect(data.UserStatus, 'to be', 'UNCONFIRMED');
      })
      .then(() => userPool.confirmSignUp(email))
      .then(() => cognito.adminGetUser({ UserPoolId: process.env.COGNITO_POOL_ID, Username: email }).promise())
      .then((data) => {
        expect(data, 'to have key', 'UserStatus');
        expect(data.UserStatus, 'to be', 'CONFIRMED');
      })
      .then(() => deleteUser()));
});
