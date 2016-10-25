'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const db = require('../lib/db');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const request = require('../lib/request');
const vandium = require('vandium');


/**
 * Approve app
 */
module.exports.appApprove = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      pathParameters: vandium.types.object().keys({
        id: vandium.types.string().required(),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  db.connectEnv(env);
  async.waterfall([
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
      const ses = new aws.SES({ apiVersion: '2010-12-01', region: env.REGION });
      ses.sendEmail({
        Source: env.SES_EMAIL_FROM,
        Destination: { ToAddresses: [vendor.email] },
        Message: {
          Subject: {
            Data: 'App approval in Keboola Developer Portal',
          },
          Body: {
            Text: {
              Data: `Your app ${appId} has been approved`,
            },
          },
        },
      }, err => cb(err));
    },
  ], (err) => {
    db.end();
    return request.response(err, null, event, context, callback, 204);
  });
}, context, callback));


/**
 * Apps List
 */
module.exports.apps = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      queryStringParameters: vandium.types.object().keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
        filter: vandium.types.string(),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  db.connectEnv(env);
  async.waterfall([
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.listApps(
        event.queryStringParameters.filter,
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
}, context, callback));


/**
 * Make user admin
 */
module.exports.userAdmin = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      pathParameters: vandium.types.object().keys({
        email: vandium.types.email()
          .error(Error('Parameter email must have format of email address')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  async.waterfall([
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

        const isAdmin = _.get(_.find(
          data.UserAttributes,
          o => o.Name === 'custom:isAdmin'
        ), 'Value', null);
        if (isAdmin) {
          return cb(error.badRequest('Is already admin'));
        }

        return cb(null, data);
      });
    },
    function (user, cb) {
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
}, context, callback));


/**
 * Enable user
 */
module.exports.userEnable = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      pathParameters: vandium.types.object().keys({
        email: vandium.types.email()
          .error(Error('Parameter email must have format of email address')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  async.waterfall([
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
    function (user, cb) {
      const vendor = _.get(_.find(
        user.UserAttributes,
        o => (o.Name === 'profile')
      ), 'Value', null);
      const ses = new aws.SES({ apiVersion: '2010-12-01', region: env.REGION });
      ses.sendEmail({
        Source: env.SES_EMAIL_FROM,
        Destination: { ToAddresses: [event.pathParameters.email] },
        Message: {
          Subject: {
            Data: 'Welcome to Keboola Developer Portal',
          },
          Body: {
            Text: {
              Data: `Your account in Keboola Developer Portal for vendor ${vendor} has been approved`,
            },
          },
        },
      }, err => cb(err));
    },
  ], err => request.response(err, null, event, context, callback, 204));
}, context, callback));


/**
 * Users List
 */
module.exports.users = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      queryStringParameters: vandium.types.object().keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
        filter: vandium.types.string(),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  let filter;
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
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  async.waterfall([
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
}, context, callback));
