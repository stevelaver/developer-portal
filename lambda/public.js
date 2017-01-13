'use strict';

import App from '../lib/app';
import Validation from '../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const db = require('../lib/db');
const error = require('../lib/error');
const html = require('../views/landing.html');
const joi = require('joi');
const request = require('../lib/request');

const app = new App(db, process.env, error);
const validation = new Validation(joi, error);

/**
 * Landing Page
 */
module.exports.landing = (event, context, callback) => request.htmlErrorHandler(() =>
  callback(null, {
    headers: {'Content-Type': 'text/html'},
    body: html({apiEndpoint: process.env.API_ENDPOINT}),
    statusCode: 200,
  })
  , event, context, callback);


/**
 * Not Found Page
 */
module.exports.notFound = (event, context, callback) => request.errorHandler(() =>
  request.response(error.notFound(), null, event, context, callback)
  , event, context, callback);


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

/**
 * Stacks List
 */
module.exports.stacksList = (event, context, callback) => request.errorHandler(() => {
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => app.listStacks()),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
