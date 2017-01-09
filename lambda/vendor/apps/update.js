'use strict';

import App from '../../../lib/app';
import Validation from '../../../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const request = require('../../../lib/request');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const identity = require('../../../lib/identity');
const joi = require('joi');

const app = new App(db, process.env, error);
const validation = new Validation();

module.exports.appsCreate = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    body: validation.createAppSchema(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
    .then(user => app.insertApp(JSON.parse(event.body), user)),
    db,
    event,
    context,
    callback,
    201
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


module.exports.appsUpdate = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
    },
    body: validation.updateAppSchema(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
    .then(user => app.updateApp(
      event.pathParameters.appId,
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
