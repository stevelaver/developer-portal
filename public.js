'use strict';
var async = require('async');
var db = require('./lib/db');
var vandium = require('vandium');
require('dotenv').config();

var addIcons = function(app) {
  app.icon = {
    32: app.icon32 ? process.env.ICONS_PUBLIC_FOLDER + '/' + app.icon32 : null,
    64: app.icon64 ? process.env.ICONS_PUBLIC_FOLDER + '/' + app.icon64 : null
  };
  delete app.icon32;
  delete app.icon64;
};

module.exports.detail = vandium.createInstance({
  validation: {
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
      db.getPublishedApp(event.path.appId, event.path.version, function(err, app) {
        if (err) {
          return callbackLocal(err);
        }
        addIcons(app);
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
  db.connect({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    ssl: process.env.RDS_SSL
  });
  async.waterfall([
    function (callbackLocal) {
      db.listAllPublishedApps(event.query.offset, event.query.limit, function(err, res) {
        if (err) {
          return callbackLocal(err);
        }
        res.map(addIcons);
        return callbackLocal(null, res);
      });
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});

module.exports.versions = vandium.createInstance({
  validation: {
    path: {
      appId: vandium.types.string().required()
    },
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
    function(callbackLocal) {
      db.listPublishedAppVersions(event.path.appId, event.query.offset, event.query.limit, function(err, res) {
        if (err) {
          return callbackLocal(err);
        }
        res.map(addIcons);
        return callbackLocal(null, res);
      });
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});

module.exports.vendorsList = vandium.createInstance({
  validation: {
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
  db.listVendors(event.query.offset, event.query.limit, function(err, result) {
    db.end();
    return callback(err, result);
  });
});

module.exports.vendorDetail = vandium.createInstance({
  validation: {
    path: {
      vendor: vandium.types.string().required()
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
  db.getVendor(event.path.vendor, function(err, result) {
    db.end();
    return callback(err, result);
  });
});
