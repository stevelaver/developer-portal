'use strict';

import App from '../../../lib/app';
import Identity from '../../../lib/identity';
import Validation from '../../../lib/validation';

require('babel-polyfill');
const request = require('../../../lib/request');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const joi = require('joi');
const jwt = require('jsonwebtoken');

const app = new App(db, Identity, process.env, error);
const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);

/**
 * Create app
 */
module.exports.appsCreate = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
    },
    body: validation.createAppSchema(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(event.headers.Authorization))
    .then(user => app.createApp(JSON.parse(event.body), event.pathParameters.vendor, user)),
    db,
    event,
    context,
    callback,
    201
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Update app
 */
module.exports.appsUpdate = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      app: joi.string().required(),
      vendor: joi.string().required(),
    },
    body: validation.updateAppSchema(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(event.headers.Authorization))
    .then(user => app.updateApp(
      event.pathParameters.app,
      event.pathParameters.vendor,
      JSON.parse(event.body),
      user
    )),
    db,
    event,
    context,
    callback,
    204
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
