'use strict';

import App from '../../../lib/app';
import Identity from '../../../lib/identity';
import Validation from '../../../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const joi = require('joi');
const jwt = require('jsonwebtoken');
const request = require('../../../lib/request');

const app = new App(db, Identity, process.env, error);
const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);

module.exports.list = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    pagination: true,
    path: {
      app: joi.string().required(),
      vendor: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(event.headers.Authorization))
    .then(user => app.listAppVersions(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null)
    )),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


module.exports.rollback = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      app: joi.string().required(),
      vendor: joi.string().required(),
      version: joi.number(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(event.headers.Authorization))
    .then(user => app.rollbackAppVersion(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
      event.pathParameters.version
    )),
    db,
    event,
    context,
    callback,
    204
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
