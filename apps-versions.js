'use strict';
var async = require('async');
var db = require('lib/db');
var identity = require('lib/identity');
var log = require('lib/log');
var vandium = require('vandium');
require('dotenv').config({silent: true});

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
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    ssl: process.env.RDS_SSL
  });
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(process.env.REGION, event.headers.Authorization, callbackLocal);
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
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    ssl: process.env.RDS_SSL
  });
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(process.env.REGION, event.headers.Authorization, callbackLocal);
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
