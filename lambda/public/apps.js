'use strict';

import App from '../../lib/app';
import Identity from '../../lib/identity';
import Validation from '../../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const db = require('../../lib/db');
const error = require('../../lib/error');
const joi = require('joi');
const request = require('../../lib/request');

const app = new App(db, Identity, process.env, error);
const validation = new Validation(joi, error);


function detail(event, context, callback) {
  validation.validate(event, {
    path: {
      vendor: joi.string().required(),
      app: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => app.getAppWithVendor(
        event.pathParameters.app,
        null,
        true
      )),
    db,
    event,
    context,
    callback
  );
}

function list(event, context, callback) {
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
}


module.exports.apps = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/apps':
      return list(event, context, callback);
    case '/apps/{vendor}/{app}':
      return detail(event, context, callback);
    default:
      throw error.notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
