'use strict';

require('babel-polyfill');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const log = require('../lib/log');
const vandium = require('vandium');

module.exports.list = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required'))
      }),
      path: vandium.types.object().keys({
        appId: vandium.types.string().required()
      }),
      query: vandium.types.object().keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow('')
      })
    }
  }
}).handler(function(event, context, callback) {
  log.start('appsVersions', event);
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(env.REGION, event.headers.Authorization, callbackLocal);
    },
    function (user, callbackLocal) {
      db.checkAppAccess(event.path.appId, user.vendor, function(err) {
        return callbackLocal(err);
      });
    },
    function(callbackLocal) {
      db.listVersions(event.path.appId, event.query.offset, event.query.limit, callbackLocal);
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});


module.exports.rollback = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    }),
    path: {
      appId: vandium.types.string().required(),
      version: vandium.types.number()
    }
  }
}).handler(function(event, context, callback) {
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(env.REGION, event.headers.Authorization, callbackLocal);
    },
    function (user, callbackLocal) {
      db.checkAppAccess(event.path.appId, user.vendor, function(err) {
        return callbackLocal(err, user.email);
      });
    },
    function (user, callbackLocal) {
      db.getApp(event.path.appId, event.path.version, function(err, res) {
        callbackLocal(err, res, user);
      });
    },
    function(app, user, callbackLocal) {
      delete app.version;
      db.updateApp(app, event.path.appId, user.email, callbackLocal);
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});
