'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const log = require('../lib/log');
const vandium = require('vandium');

const addIcons = function (app) {
  const res = app;
  res.icon = {
    32: app.icon32 ? `${env.CLOUDFRONT_URI}/${app.icon32}` : null,
    64: app.icon64 ? `${env.CLOUDFRONT_URI}/${app.icon64}` : null,
  };
  delete res.icon32;
  delete res.icon64;
};

const dbConnect = function () {
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
};

/**
 * App Detail
 */
module.exports.detail = vandium.createInstance({
  validation: {
    schema: {
      path: vandium.types.object().keys({
        appId: vandium.types.string().required(),
        version: vandium.types.number().integer(),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.init(env.LOG_HOST, env.LOG_PORT, env.SERVICE_NAME);
  log.start('publicDetail', event);
  dbConnect();
  async.waterfall([
    function (callbackLocal) {
      db.getPublishedApp(event.path.appId, event.path.version, (err, app) => {
        if (err) {
          return callbackLocal(err);
        }
        addIcons(app);
        return callbackLocal(null, app);
      });
    },
  ], (err, result) => {
    db.end();
    return callback(err, result);
  });
});


/**
 * Apps List
 */
module.exports.list = vandium.createInstance({
  validation: {
    schema: {
      queryStringParameters: vandium.types.object().allow(null).keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('publicList', event);
  dbConnect();
  async.waterfall([
    function (callbackLocal) {
      db.listAllPublishedApps(
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null),
        (err, res) => {
          if (err) {
            return callbackLocal(err);
          }
          res.map(addIcons);
          return callbackLocal(null, res);
        }
      );
    },
  ], (err, result) => {
    db.end();
    return callback(err, {
      statusCode: 200,
      body: JSON.stringify(result),
    });
  });
});


/**
 * App Versions
 */
module.exports.versions = vandium.createInstance({
  validation: {
    schema: {
      path: vandium.types.object().keys({
        appId: vandium.types.string().required(),
      }),
      query: vandium.types.object().keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('publicVersions', event);
  dbConnect();
  async.waterfall([
    function (callbackLocal) {
      db.listPublishedAppVersions(
        event.path.appId,
        event.query.offset,
        event.query.limit,
        (err, res) => {
          if (err) {
            return callbackLocal(err);
          }
          res.map(addIcons);
          return callbackLocal(null, res);
        }
      );
    },
  ], (err, result) => {
    db.end();
    return callback(err, result);
  });
});


/**
 * Vendors List
 */
module.exports.vendorsList = vandium.createInstance({
  validation: {
    schema: {
      query: vandium.types.object().keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('publicVendorsList', event);
  dbConnect();
  db.listVendors(event.query.offset, event.query.limit, (err, result) => {
    db.end();
    return callback(err, result);
  });
});


/**
 * Vendor Detail
 */
module.exports.vendorDetail = vandium.createInstance({
  validation: {
    schema: {
      path: vandium.types.object().keys({
        vendor: vandium.types.string().required(),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('publicVendorDetail', event);
  dbConnect();
  db.getVendor(event.path.vendor, (err, result) => {
    db.end();
    return callback(err, result);
  });
});
