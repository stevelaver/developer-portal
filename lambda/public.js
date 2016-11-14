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

const dbCallback = (err, res, callback) => {
  if (db) {
    try {
      db.end();
    } catch (err2) {
      // Ignore
    }
  }
  callback(err);
};

/**
 * App Detail
 */
module.exports.detail = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    path: {
      appId: joi.string().required(),
      version: joi.number().integer(),
    },
  });
  db.connect(env);
  db.getPublishedApp(
    event.pathParameters.appId,
    _.get(event, 'pathParameters.version', null),
  )
  .then((app) => {
    addIcons(app);
    db.end();
    return request.response(null, app, event, context, callback);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));


/**
 * Apps List
 */
module.exports.list = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    pagination: true,
  });
  db.connect(env);
  db.listAllPublishedApps(
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null)
  )
  .then((app) => {
    db.end();
    return request.response(null, app, event, context, callback);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));


/**
 * App Versions
 */
module.exports.versions = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    path: {
      appId: joi.string().required(),
    },
    pagination: true,
  });
  db.connect(env);
  db.listPublishedAppVersions(
    event.pathParameters.appId,
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null)
  )
  .then((res) => {
    res.map(addIcons);
    db.end();
    return request.response(null, res, event, context, callback);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));


/**
 * Vendors List
 */
module.exports.vendorsList = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    pagination: true,
  });
  db.connect(env);
  db.listVendors(
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null),
  )
  .then((res) => {
    db.end();
    return request.response(null, res, event, context, callback);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));


/**
 * Vendor Detail
 */
module.exports.vendorDetail = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    path: {
      vendor: joi.string().required(),
    },
  });
  db.connect(env);
  db.getVendor(event.pathParameters.vendor)
  .then((res) => {
    db.end();
    return request.response(null, res, event, context, callback);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));
