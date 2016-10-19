'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const request = require('../lib/request');
const vandium = require('vandium');

const addIcons = function (app) {
  const res = app;
  res.icon = {
    32: app.icon32 ? `https://${env.CLOUDFRONT_URI}/${app.icon32}` : null,
    64: app.icon64 ? `https://${env.CLOUDFRONT_URI}/${app.icon64}` : null,
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

const defaultCallback = function (err, res, cb) {
  db.end();
  cb(err, res);
};

/**
 * App Detail
 */
module.exports.detail = vandium.createInstance({
  validation: {
    schema: {
      pathParameters: vandium.types.object().allow(null).keys({
        appId: vandium.types.string().required(),
        version: vandium.types.number().integer(),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  // log.init(env.LOG_HOST, env.LOG_PORT, env.SERVICE_NAME);
  dbConnect();
  async.waterfall([
    function (cb) {
      db.getPublishedApp(
        event.pathParameters.appId,
        _.get(event, 'pathParameters.version', null),
        (err, app) => {
          if (err) {
            return cb(err);
          }
          addIcons(app);
          return cb(null, app);
        }
      );
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, (err, res) => defaultCallback(err, res, callback)));


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
}).handler((event, context, callback) => request.errorHandler(() => {
  dbConnect();
  async.waterfall([
    function (cb) {
      db.listAllPublishedApps(
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null),
        (err, res) => {
          if (err) {
            return cb(err);
          }
          res.map(addIcons);
          return cb(null, res);
        }
      );
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, (err, res) => defaultCallback(err, res, callback)));


/**
 * App Versions
 */
module.exports.versions = vandium.createInstance({
  validation: {
    schema: {
      pathParameters: vandium.types.object().keys({
        appId: vandium.types.string().required(),
      }),
      queryStringParameters: vandium.types.object().allow(null).keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  dbConnect();
  async.waterfall([
    function (cb) {
      db.listPublishedAppVersions(
        event.pathParameters.appId,
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null),
        (err, res) => {
          if (err) {
            return cb(err);
          }
          res.map(addIcons);
          return cb(null, res);
        }
      );
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, (err, res) => defaultCallback(err, res, callback)));


/**
 * Vendors List
 */
module.exports.vendorsList = vandium.createInstance({
  validation: {
    schema: {
      queryStringParameters: vandium.types.object().allow(null).keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  dbConnect();
  db.listVendors(
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null),
    (err, res) => {
      db.end();
      return request.response(err, res, event, context, callback);
    }
  );
}, context, (err, res) => defaultCallback(err, res, callback)));


/**
 * Vendor Detail
 */
module.exports.vendorDetail = vandium.createInstance({
  validation: {
    schema: {
      pathParameters: vandium.types.object().keys({
        vendor: vandium.types.string().required(),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  dbConnect();
  db.getVendor(event.pathParameters.vendor, (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, (err, res) => defaultCallback(err, res, callback)));
