'use strict';

import App from '../app/app';
import Services from '../lib/services';
import Vendor from '../app/vendor';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');
const joi = require('joi');

const db = require('../lib/db');
const request = require('../lib/request');

const services = new Services(process.env);
const app = new App(Services, db, process.env);
const validation = Services.getValidation();
const vendorApp = new Vendor(services, db, process.env, Services.getError());


function landing(event, context, callback) {
  return callback(null, {
    headers: { },
    body: 'Keboola Developer Portal',
    statusCode: 200,
  });
}

function detail(event, context, callback) {
  validation.validate(event, {
    path: {
      app: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    () => app.getAppWithVendor(_.get(event.pathParameters, 'app', event.pathParameters.app)),
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
    () => app.publicListApps(
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null),
    ),
    event,
    context,
    callback
  );
}

function stacks(event, context, callback) {
  return request.responseDbPromise(
    () => db.listStacks(),
    event,
    context,
    callback
  );
}

function getVendorsList(event, context, callback) {
  validation.validate(event, {
    pagination: true,
  });

  return request.responseDbPromise(
    () => vendorApp.list(
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null),
    ),
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
    () => vendorApp.get(event.pathParameters.vendor),
    event,
    context,
    callback
  );
}


module.exports.public = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/':
      return landing(event, context, callback);
    case '/apps':
      return list(event, context, callback);
    case '/apps/{app}':
      return detail(event, context, callback);
    case '/stacks':
      return stacks(event, context, callback);
    case '/vendors':
      return getVendorsList(event, context, callback);
    case '/vendors/{vendor}':
      return getVendor(event, context, callback);
    default:
      throw Services.getError().notFound();
  }
}, event, context, callback);
