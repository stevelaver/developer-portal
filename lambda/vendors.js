'use strict';

import Identity from '../lib/identity';
import Vendor from '../app/vendor';
import Validation from '../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const joi = require('joi');
const jwt = require('jsonwebtoken');

const db = require('../lib/db');
const error = require('../lib/error');
const request = require('../lib/request');

const app = new Vendor(db, process.env, error);
const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);


function getVendorsList(event, context, callback) {
  validation.validate(event, {
    pagination: true,
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => app.list(
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
      .then(() => app.get(event.pathParameters.vendor)),
    db,
    event,
    context,
    callback
  );
}

function createVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    body: validation.adminCreateVendor(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.create(JSON.parse(event.body))),
    db,
    event,
    context,
    callback,
    204
  );
}

module.exports.vendors = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/vendors':
      return getVendorsList(event, context, callback);
    case '/vendors/{vendor}':
      return getVendor(event, context, callback);
    case '/admin/vendors':
      return createVendor(event, context, callback);
    default:
      throw error.badRequest();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
