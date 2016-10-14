'use strict';

require('babel-polyfill');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const log = require('../lib/log');
const vandium = require('vandium');

module.exports.handler = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required'))
      }),
      path: vandium.types.object().keys({
        appId: vandium.types.string().required(),
        version: vandium.types.number().integer()
      })
    }
  }
}).handler(function(event, context, callback) {
  log.start('appsDetail', event);
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
    function (callbackLocal) {
      db.getApp(event.path.appId, event.path.version, callbackLocal);
    },
    function(app, callbackLocal) {
      app.icon = {
        32: `${env.CLOUDFRONT_URI}/${app.icon32}`,
        64: `${env.CLOUDFRONT_URI}/${app.icon64}`,
      };
      delete app.icon32;
      delete app.icon64;
      callbackLocal(null, app);
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});
