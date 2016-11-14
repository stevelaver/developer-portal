'use strict';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const db = require('../lib/db');
const email = require('../lib/email');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const joi = require('joi');
const Promise = require('bluebird');
const request = require('../lib/request');
const validation = require('../lib/validation');


const dbCallback = (err, res, callback) => {
  if (db) {
    db.end();
  }
  callback(err);
};

/**
 * Approve app
 */
module.exports.appApprove = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      id: joi.string().required(),
    },
  });
  db.connect(env);
  let user;
  let app;
  identity.getAdmin(env.REGION, event.headers.Authorization)
  .then(u => new Promise((resolve) => {
    user = u;
    resolve();
  }))
  .then(() => db.getApp(event.pathParameters.id))
  .then((data) => {
    app = data;
    if (app.isApproved) {
      throw error.badRequest('Already approved');
    }
    return db.updateApp({ isApproved: 1 }, event.pathParameters.id, user.email);
  })
  .then(() => db.getVendor(app.vendor))
  .then((vendor) => {
    email.init(env.REGION, env.SES_EMAIL_FROM);
    return email.send(
      vendor.email,
      'App approval in Keboola Developer Portal',
      'Keboola Developer Portal',
      `Your app <strong>${app.id}</strong> has been approved.`,
    );
  })
  .then(() => {
    db.end();
    return request.response(null, null, event, context, callback, 204);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));


/**
 * Apps List
 */
module.exports.apps = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    pagination: true,
    query: {
      filter: joi.string(),
    },
  });
  db.connect(env);
  identity.getAdmin(env.REGION, event.headers.Authorization)
  .then(() => db.listApps(
    _.get(event, 'queryStringParameters.filter', null),
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null)
  ))
  .then((res) => {
    db.end();
    return request.response(null, res, event, context, callback);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));


/**
 * Make user admin
 */
module.exports.userAdmin = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      email: joi.string().email()
        .error(Error('Parameter email must have format of email address')),
    },
  });
  aws.config.setPromisesDependency(Promise);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  identity.getAdmin(env.REGION, event.headers.Authorization)
  .then(() => provider.adminGetUser({
    UserPoolId: env.COGNITO_POOL_ID,
    Username: event.pathParameters.email,
  }).promise())
  .then((data) => {
    const userData = identity.formatUser(data);
    if (userData.isAdmin) {
      throw error.badRequest('Is already admin');
    }
  })
  .then(() => provider.adminUpdateUserAttributes({
    UserPoolId: env.COGNITO_POOL_ID,
    Username: event.pathParameters.email,
    UserAttributes: [
      {
        Name: 'custom:isAdmin',
        Value: '1',
      },
    ],
  }).promise())
  .then(() => request.response(null, null, event, context, callback, 204))
  .catch(err => request.response(error.authError(err), null, event, context, callback));
}, event, context, (err, res) => dbCallback(err, res, callback));


/**
 * Enable user
 */
module.exports.userEnable = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      email: joi.string().email()
        .error(Error('Parameter email must have format of email address')),
    },
  });
  aws.config.setPromisesDependency(Promise);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  let user;
  identity.getAdmin(env.REGION, event.headers.Authorization)
  .then(() => provider.adminGetUser({
    UserPoolId: env.COGNITO_POOL_ID,
    Username: event.pathParameters.email,
  }).promise())
  .then((data) => {
    if (data.Enabled) {
      throw error.notFound('Already Enabled');
    }
    user = data;
  })
  .then(() => provider.adminEnableUser({
    UserPoolId: env.COGNITO_POOL_ID,
    Username: event.pathParameters.email,
  }).promise())
  .then(() => {
    user = identity.formatUser(user);
    email.init(env.REGION, env.SES_EMAIL_FROM);
    return email.send(
      user.email,
      'Welcome to Keboola Developer Portal',
      'Welcome to Keboola Developer Portal',
      `Your account in Keboola Developer Portal for vendor ${user.vendor} has been approved.`
    );
  })
  .then(() => request.response(null, null, event, context, callback, 204))
  .catch(err => request.response(error.authError(err), null, event, context, callback));
}, event, context, (err, res) => dbCallback(err, res, callback));


/**
 * Users List
 */
module.exports.users = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    pagination: true,
    query: {
      filter: joi.string(),
    },
  });
  let filter = '';
  if (_.has(event, 'queryStringParameters.filter')) {
    switch (event.queryStringParameters.filter) {
      case 'enabled':
        filter = 'status = "Enabled"';
        break;
      case 'disabled':
        filter = 'status = "Disabled"';
        break;
      case 'unconfirmed':
        filter = 'cognito:user_status = "Unconfirmed"';
        break;
      case 'confirmed':
        filter = 'cognito:user_status = "Confirmed"';
        break;
      default:
        filter = '';
    }
  }
  aws.config.setPromisesDependency(Promise);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  identity.getAdmin(env.REGION, event.headers.Authorization)
  .then(() => provider.listUsers({
    UserPoolId: env.COGNITO_POOL_ID,
    Filter: filter,
  }).promise())
  .then(data => _.map(data.Users, item => ({
    email: item.Username,
    name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', null),
    vendor: _.get(_.find(item.Attributes, o => (o.Name === 'profile')), 'Value', null),
    createdOn: item.UserCreateDate,
    isEnabled: item.Enabled,
    status: item.UserStatus,
    id: _.get(_.find(item.Attributes, o => (o.Name === 'sub')), 'Value', null),
  })))
  .then(res => request.response(null, res, event, context, callback))
  .catch(err => request.response(error.authError(err), null, event, context, callback));
}, event, context, (err, res) => dbCallback(err, res, callback));
