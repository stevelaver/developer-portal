'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const db = require('../lib/db');
const email = require('../lib/email');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const joi = require('joi');
const request = require('../lib/request');
const validation = require('../lib/validation');


/**
 * Approve app
 */
module.exports.appApprove = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    auth: true,
    path: {
      id: joi.string().required(),
    },
  });
  db.connectEnv(env);

  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.getApp(event.pathParameters.id, null, (err, data) => {
        if (data.isApproved) {
          return cb(error.badRequest('Already approved'));
        }
        return cb(err, user, data);
      });
    },
    function (user, app, cb) {
      db.updateApp({ isApproved: 1 }, event.pathParameters.id, user.email, (err) => {
        cb(err, app);
      });
    },
    function (app, cb) {
      db.getVendor(app.vendor, (err, data) => {
        cb(err, app.id, data);
      });
    },
    function (appId, vendor, cb) {
      email.init(env.REGION, env.SES_EMAIL_FROM);
      email.send(
        vendor.email,
        'App approval in Keboola Developer Portal',
        'Keboola Developer Portal',
        `Your app <strong>${appId}</strong> has been approved.`,
        null,
        null,
        err => cb(err)
      );
    },
  ], (err) => {
    db.end();
    return request.response(err, null, event, context, callback, 204);
  });
}, event, context, callback);


/**
 * Apps List
 */
module.exports.apps = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    auth: true,
    pagination: true,
    query: {
      filter: joi.string(),
    },
  });
  db.connectEnv(env);
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.listApps(
        _.get(event, 'queryStringParameters.filter', null),
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null),
        (err, result) => {
          db.end();
          return cb(err, result);
        }
      );
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, event, context, callback);


/**
 * Make user admin
 */
module.exports.userAdmin = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    auth: true,
    path: {
      email: joi.string().email()
        .error(Error('Parameter email must have format of email address')),
    },
  });
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      provider.adminGetUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.pathParameters.email,
      }, (err, data) => {
        if (err) {
          return cb(error.authError(err));
        }

        const userData = identity.formatUser(data);
        if (userData.isAdmin) {
          return cb(error.badRequest('Is already admin'));
        }

        return cb();
      });
    },
    function (cb) {
      provider.adminUpdateUserAttributes({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.pathParameters.email,
        UserAttributes: [
          {
            Name: 'custom:isAdmin',
            Value: '1',
          },
        ],
      }, err => cb(error.authError(err)));
    },
  ], err => request.response(err, null, event, context, callback, 204));
}, event, context, callback);


/**
 * Enable user
 */
module.exports.userEnable = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    auth: true,
    path: {
      email: joi.string().email()
        .error(Error('Parameter email must have format of email address')),
    },
  });
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      provider.adminGetUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.pathParameters.email,
      }, (err, data) => {
        if (err) {
          return cb(error.authError(err));
        }

        if (data.Enabled) {
          return cb(error.notFound('Already Enabled'));
        }

        return cb(null, data);
      });
    },
    function (user, cb) {
      provider.adminEnableUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.pathParameters.email,
      }, err => (err ? cb(error.authError(err)) : cb(null, user))
      );
    },
    function (userData, cb) {
      const user = identity.formatUser(userData);
      email.init(env.REGION, env.SES_EMAIL_FROM);
      email.send(
        user.email,
        'Welcome to Keboola Developer Portal',
        'Welcome to Keboola Developer Portal',
        `Your account in Keboola Developer Portal for vendor ${user.vendor} has been approved.`,
        null,
        null,
        err => cb(err)
      );
    },
  ], err => request.response(err, null, event, context, callback, 204));
}, event, context, callback);


/**
 * Users List
 */
module.exports.users = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
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
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      provider.listUsers({
        UserPoolId: env.COGNITO_POOL_ID,
        Filter: filter,
      }, cb);
    },
    function (data, cb) {
      cb(null, _.map(data.Users, item => ({
        email: item.Username,
        name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', null),
        vendor: _.get(_.find(item.Attributes, o => (o.Name === 'profile')), 'Value', null),
        createdOn: item.UserCreateDate,
        isEnabled: item.Enabled,
        status: item.UserStatus,
        id: _.get(_.find(item.Attributes, o => (o.Name === 'sub')), 'Value', null),
      })));
    },
  ], (err, res) => request.response(err, res, event, context, callback));
}, event, context, callback);
