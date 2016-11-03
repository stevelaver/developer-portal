'use strict';

require('babel-polyfill');
const _ = require('lodash');
const db = require('../lib/db');
const env = require('../env.yml');
const joi = require('joi');
const request = require('../lib/request');
const validation = require('../lib/validation');

const addIcons = function (app) {
  const res = app;
  res.icon = {
    32: app.icon32 ? `https://${env.CLOUDFRONT_URI}/${app.icon32}` : null,
    64: app.icon64 ? `https://${env.CLOUDFRONT_URI}/${app.icon64}` : null,
  };
  delete res.icon32;
  delete res.icon64;
};

const defaultCallback = function (err, res, cb) {
  db.end();
  cb(err, res);
};

/**
 * App Detail
 */
module.exports.detail = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    path: {
      appId: joi.string().required(),
      version: joi.number().integer(),
    },
  }));
  db.connectEnv(env);
  db.getPublishedApp(
    event.pathParameters.appId,
    _.get(event, 'pathParameters.version', null),
    (err, app) => {
      db.end();
      if (err) {
        return request.response(err, null, event, context, callback);
      }
      addIcons(app);
      return request.response(null, app, event, context, callback);
    }
  );
}, context, (err, res) => defaultCallback(err, res, callback));


/**
 * Apps List
 */
module.exports.list = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    pagination: true,
  }));
  db.connectEnv(env);
  db.listAllPublishedApps(
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null),
    (err, res) => {
      db.end();
      if (err) {
        return request.response(err, null, event, context, callback);
      }
      res.map(addIcons);
      return request.response(null, res, event, context, callback);
    }
  );
}, context, (err, res) => defaultCallback(err, res, callback));


/**
 * App Versions
 */
module.exports.versions = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    path: {
      appId: joi.string().required(),
    },
    pagination: true,
  }));
  db.connectEnv(env);
  db.listPublishedAppVersions(
    event.pathParameters.appId,
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null),
    (err, res) => {
      db.end();
      if (err) {
        return request.response(err, null, event, context, callback);
      }
      res.map(addIcons);
      return request.response(null, res, event, context, callback);
    }
  );
}, context, (err, res) => defaultCallback(err, res, callback));


/**
 * Vendors List
 */
module.exports.vendorsList = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    pagination: true,
  }));
  db.connectEnv(env);
  db.listVendors(
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null),
    (err, res) => {
      db.end();
      return request.response(err, res, event, context, callback);
    }
  );
}, context, (err, res) => defaultCallback(err, res, callback));


/**
 * Vendor Detail
 */
module.exports.vendorDetail = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    path: {
      vendor: joi.string().required(),
    },
  }));
  db.connectEnv(env);
  db.getVendor(event.pathParameters.vendor, (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, (err, res) => defaultCallback(err, res, callback));
