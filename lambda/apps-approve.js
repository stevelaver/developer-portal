'use strict';

require('babel-polyfill');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const request = require('../lib/request');
const UserError = require('../lib/UserError');
const vandium = require('vandium');

/**
 * Approve
 */
module.exports.handler = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(new UserError('Authorization header is required')),
      }),
      pathParameters: vandium.types.object().keys({
        appId: vandium.types.string().required()
          .error(new UserError('Parameter appId is required')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
    function (cb) {
      identity.getUser(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.checkAppAccess(event.pathParameters.appId, user.vendor, err => cb(err));
    },
    function (cb) {
      db.getApp(event.pathParameters.appId, null, (err, data) => {
        if (err) {
          return cb(err);
        }

        if (data.isApproved) {
          return cb(new UserError('Already approved'));
        }
        return cb(err, data);
      });
    },
    function (app, cb) {
      if (!app.repository.type) {
        return cb(new UserError('App property repository.type cannot be empty'));
      }
      if (!app.repository.uri) {
        return cb(new UserError('App property repository.uri cannot be empty'));
      }
      if (!app.repository.tag) {
        return cb(new UserError('App property repository.tag cannot be empty'));
      }
      if (!app.shortDescription) {
        return cb(new UserError('App property shortDescription cannot be empty'));
      }
      if (!app.longDescription) {
        return cb(new UserError('App property longDescription cannot be empty'));
      }
      if (!app.licenseUrl) {
        return cb(new UserError('App property licenseUrl cannot be empty'));
      }
      if (!app.documentationUrl) {
        return cb(new UserError('App property documentationUrl cannot be empty'));
      }
      if (!app.icon32) {
        return cb(new UserError('App icon of size 32px is missing, upload it first.'));
      }
      if (!app.icon64) {
        return cb(new UserError('App icon of size 64px is missing, upload it first.'));
      }
      return cb();
    },
  ], (err) => {
    db.end();
    return request.response(err, null, event, context, callback, 202);
  });
}, context, callback));
