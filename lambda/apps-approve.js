'use strict';

require('babel-polyfill');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const notification = require('../lib/notification');
const request = require('../lib/request');
const vandium = require('vandium');

/**
 * Approve
 */
module.exports.handler = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      pathParameters: vandium.types.object().keys({
        appId: vandium.types.string().required()
          .error(Error('Parameter appId is required')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  db.connectEnv(env);
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
          return cb(error.badRequest('Already approved'));
        }
        return cb(err, data);
      });
    },
    function (app, cb) {
      if (!app.repository.type) {
        return cb(error.badRequest('App property repository.type cannot be empty'));
      }
      if (!app.repository.uri) {
        return cb(error.badRequest('App property repository.uri cannot be empty'));
      }
      if (!app.repository.tag) {
        return cb(error.badRequest('App property repository.tag cannot be empty'));
      }
      if (!app.shortDescription) {
        return cb(error.badRequest('App property shortDescription cannot be empty'));
      }
      if (!app.longDescription) {
        return cb(error.badRequest('App property longDescription cannot be empty'));
      }
      if (!app.licenseUrl) {
        return cb(error.badRequest('App property licenseUrl cannot be empty'));
      }
      if (!app.documentationUrl) {
        return cb(error.badRequest('App property documentationUrl cannot be empty'));
      }
      if (!app.icon32) {
        return cb(error.badRequest('App icon of size 32px is missing, upload it first.'));
      }
      if (!app.icon64) {
        return cb(error.badRequest('App icon of size 64px is missing, upload it first.'));
      }
      return cb(null, app);
    },
    function (app, cb) {
      notification.setHook(env.SLACK_HOOK_URL, env.SERVICE_NAME);
      notification.approveApp(app, cb);
    },
  ], (err) => {
    db.end();
    return request.response(err, null, event, context, callback, 202);
  });
}, context, callback));
