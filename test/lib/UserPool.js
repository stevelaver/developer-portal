'use strict';

import Identity from '../../lib/identity';
import UserPool from '../../lib/UserPool';

const aws = require('aws-sdk');
const expect = require('unexpected');
const Promise = require('bluebird');
const env = require('../../lib/env').load();
const err = require('../../lib/error');

aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
const userPool = new UserPool(cognito, env.COGNITO_POOL_ID, env.COGNITO_CLIENT_ID, Identity, err);
let email;

const createUser = () => {
  email = `devportal-${Date.now()}@test.keboola.com`;
  return cognito.signUp({
    ClientId: env.COGNITO_CLIENT_ID,
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
    ],
  }).promise();
};

const deleteUser = () =>
  cognito.adminDeleteUser({ UserPoolId: env.COGNITO_POOL_ID, Username: email }).promise();


describe('UserPool', () => {
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

  it('listUsers', () =>
    createUser()
      .then(() => userPool.listUsers())
      .then((data) => {
        expect(data, 'to have an item satisfying', { email });
      })
      .then(() => userPool.listUsers())
      .then((data) => {
        expect(data, 'to have an item satisfying', { email });
      })
      .then(() => deleteUser()));
});
