'use strict';

import App from '../lib/app';
import Services from '../lib/Services';
import Vendor from '../app/vendor';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');
const joi = require('joi');

const db = require('../lib/db');
const landingHtml = require('../views/landing.html');
const request = require('../lib/request');

const services = new Services(process.env);
const identity = Services.getIdentity();
const app = new App(db, identity, process.env, Services.getError());
const validation = Services.getValidation();
const vendorApp = new Vendor(services, db, process.env, Services.getError());


function landing(event, context, callback) {
  return callback(null, {
    headers: { 'Content-Type': 'text/html' },
    body: landingHtml({ apiEndpoint: process.env.API_ENDPOINT }),
    statusCode: 200,
  });
}

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

function stacks(event, context, callback) {
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => db.listStacks()),
    db,
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
    db.connect(process.env)
      .then(() => vendorApp.list(
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
      .then(() => vendorApp.get(event.pathParameters.vendor))
      .then(data => ({
        id: data.id,
        name: data.name,
        address: data.address,
        email: data.email,
      })),
    db,
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
    case '/apps/{vendor}/{app}':
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
}, event, context, (err, res) => db.endCallback(err, res, callback));
