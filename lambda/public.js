'use strict';

import App from '../lib/app';

require('babel-polyfill');
const _ = require('lodash');
const db = require('../lib/db');
const error = require('../lib/error');
const joi = require('joi');
const request = require('../lib/request');
const validation = require('../lib/validation');

const app = new App(db, process.env, error);

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

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => app.getAppWithVendor(
      event.pathParameters.appId,
      _.get(event, 'pathParameters.version', null),
      true
    )),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Apps List
 */
module.exports.list = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    pagination: true,
    query: {
      project: joi.number().integer(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => app.listPublishedApps(
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null),
    )),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


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

  return request.responseDbPromise(
      db.connect(process.env)
      .then(() => app.listPublishedAppVersions(
        event.pathParameters.appId,
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null)
      )),
      db,
      event,
      context,
      callback
    );
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Vendors List
 */
module.exports.vendorsList = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    pagination: true,
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => app.listVendors(
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null),
    )),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Vendor Detail
 */
module.exports.vendorDetail = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    path: {
      vendor: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => app.getVendor(event.pathParameters.vendor)),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
