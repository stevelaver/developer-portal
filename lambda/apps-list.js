'use strict';

import App from '../lib/app';

require('babel-polyfill');
const _ = require('lodash');
const db = require('../lib/db');
const error = require('../lib/error');
const identity = require('../lib/identity');
const joi = require('joi');
const request = require('../lib/request');
const validation = require('../lib/validation');

const app = new App(db, process.env, error);

module.exports.appsList = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    pagination: true,
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
    .then(user => app.listAppsForVendor(
      user.vendor,
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null),
    )),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));

module.exports.appsDetail = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
      version: joi.number().integer(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
    .then(user => app.getAppForVendor(
      event.pathParameters.appId,
      user.vendor,
      event.pathParameters.version
    )),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
