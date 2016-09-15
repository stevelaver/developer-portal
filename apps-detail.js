'use strict';
require('dotenv').config();

var async = require('async');
var db = require('lib/db');
var identity = require('lib/identity');
const vandium = require('vandium');

module.exports.handler = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    }),
    path: {
      appId: vandium.types.string().required(),
      version: vandium.types.number().integer()
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
      identity.getUser(event.headers.Authorization, callbackLocal);
    },
    function (user, callbackLocal) {
      db.checkAppAccess(event.path.appId, user.vendor, function(err) {
        return callbackLocal(err);
      });
    },
    function (callbackLocal) {
      db.getApp(event.path.appId, event.path.version, callbackLocal);
    },
    function(app, callbackLocal) {
      app.icon = {
        32: process.env.ICONS_PUBLIC_FOLDER + '/' + app.icon32,
        64: process.env.ICONS_PUBLIC_FOLDER + '/' + app.icon64
      };
      callbackLocal(null, app);
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});
