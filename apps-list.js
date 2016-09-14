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
  db.connect();
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(event.headers.authorizationToken, callbackLocal);
    },
    function(user, callbackLocal) {
      db.listAppsForVendor(user.vendor, event.query.offset, event.query.limit, callbackLocal);
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});
