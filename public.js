'use strict';
require('dotenv').config();

var async = require('async');
var db = require('lib/db');
const vandium = require('vandium');


module.exports.detail = vandium.createInstance({
  validation: {
    path: {
      appId: vandium.types.string().required()
    }
  }
}).handler(function(event, context, callback) {
  db.connect();
  async.waterfall([
    function (callbackLocal) {
      db.getPublishedApp(event.path.appId, function(err, app) {
        if (err) return dbCloseCallback(err);
        app.icon = {
          32: process.env.ICONS_PUBLIC_FOLDER + '/' + app.icon32,
          64: process.env.ICONS_PUBLIC_FOLDER + '/' + app.icon64
        };
        return callbackLocal(null, app);
      });
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});

module.exports.list = vandium.createInstance({
  validation: {
    query: {
      offset: vandium.types.number().integer().default(0).allow(''),
      limit: vandium.types.number().integer().default(100).allow('')
    }
  }
}).handler(function(event, context, callback) {
  db.connect();
  async.waterfall([
    function (callbackLocal) {
      db.listAllPublishedApps(event.query.offset, event.query.limit, function(err, res) {
        if (err) return callbackLocal(err);
        res.map(function(app) {
          app.icon = {
            32: process.env.ICONS_PUBLIC_FOLDER + '/' + app.icon32,
            64: process.env.ICONS_PUBLIC_FOLDER + '/' + app.icon64
          };
        });
        return callbackLocal(null, res);
      });
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});
