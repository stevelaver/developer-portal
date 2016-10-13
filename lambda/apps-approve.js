'use strict';

if (!global._babelPolyfill) {
  require('babel-polyfill');
}

const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const log = require('../lib/log');
const vandium = require('vandium');

/**
 * Approve
 */
module.exports.handler = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required')),
      }),
      path: vandium.types.object().keys({
        appId: vandium.types.string().required().error(Error('[422] Parameter appId is required')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('appsApprove', event);
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
  });
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(env.REGION, event.headers.Authorization, callbackLocal);
    },
    function (user, callbackLocal) {
      db.checkAppAccess(event.path.appId, user.vendor, err => callbackLocal(err));
    },
    function (callbackLocal) {
      db.getApp(event.path.appId, null, (err, data) => {
        if (err) {
          return callbackLocal(err);
        }

        if (data.isApproved) {
          return callbackLocal(Error('[400] Already approved'));
        }
        return callbackLocal(err, data);
      });
    },
    function (app, callbackLocal) {
      if (!app.repository.type) {
        return callbackLocal(Error('[400] App property repository.type cannot be empty'));
      }
      if (!app.repository.uri) {
        return callbackLocal(Error('[400] App property repository.uri cannot be empty'));
      }
      if (!app.repository.tag) {
        return callbackLocal(Error('[400] App property repository.tag cannot be empty'));
      }
      if (!app.shortDescription) {
        return callbackLocal(Error('[400] App property shortDescription cannot be empty'));
      }
      if (!app.longDescription) {
        return callbackLocal(Error('[400] App property longDescription cannot be empty'));
      }
      if (!app.licenseUrl) {
        return callbackLocal(Error('[400] App property licenseUrl cannot be empty'));
      }
      if (!app.documentationUrl) {
        return callbackLocal(Error('[400] App property documentationUrl cannot be empty'));
      }
      if (!app.icon32) {
        return callbackLocal(Error('[400] App icon of size 32px is missing, upload it first.'));
      }
      if (!app.icon64) {
        return callbackLocal(Error('[400] App icon of size 64px is missing, upload it first.'));
      }
      return callbackLocal();
    },
  ], (err) => {
    db.end();
    return callback(err);
  });
});
