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
    query: {
      offset: vandium.types.number().integer().default(0).allow(''),
      limit: vandium.types.number().integer().default(100).allow('')
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
    function(user, callbackLocal) {
      db.listAppsForVendor(user.vendor, event.query.offset, event.query.limit, callbackLocal);
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});
