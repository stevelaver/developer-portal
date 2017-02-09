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

function getVendorsList(event, context, callback) {
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
}

function getVendor(event, context, callback) {
  validation.validate(event, {
    path: ['vendor'],
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => app.getVendor(event.pathParameters.vendor)),
    db,
    event,
    context,
    callback
  );
}

module.exports.vendors = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/vendors':
      return getVendorsList(event, context, callback);
    case '/vendors/{vendor}':
      return getVendor(event, context, callback);
    default:
      throw error.badRequest();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
