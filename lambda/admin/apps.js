'use strict';

import App from '../../lib/app';
import Email from '../../lib/email';
import Identity from '../../lib/identity';
import Validation from '../../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const db = require('../../lib/db');
const error = require('../../lib/error');
const joi = require('joi');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const request = require('../../lib/request');

aws.config.setPromisesDependency(Promise);
const app = new App(db, Identity, process.env, error);
const email = new Email(
  new aws.SES({ apiVersion: '2010-12-01', region: process.env.REGION }),
  process.env.SES_EMAIL_FROM
);

const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);

function approve(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      id: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(user => app.approveApp(event.pathParameters.id, user))
      .then(vendor => email.send(
        vendor.email,
        'App approval in Keboola Developer Portal',
        'Keboola Developer Portal',
        `Your app <strong>${event.pathParameters.id}</strong> has been approved.`,
      )),
    db,
    event,
    context,
    callback,
    204
  );
}

function list(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    query: {
      filter: joi.string(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.listApps(
        _.get(event, 'queryStringParameters.filter', null),
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null)
      )),
    db,
    event,
    context,
    callback
  );
}

function detail(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      id: joi.string().required(),
      version: joi.number().integer(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.getAppWithVendorForAdmin(
        event.pathParameters.id,
        _.get(event, 'pathParameters.version', null),
        false
      )),
    db,
    event,
    context,
    callback
  );
}

function update(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      id: joi.string().required(),
    },
    body: validation.adminAppSchema(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(user => app.updateAppByAdmin(
        event.pathParameters.id,
        JSON.parse(event.body),
        user
      )),
    db,
    event,
    context,
    callback
  );
}


module.exports.apps = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/admin/apps/{id}/approve':
      return approve(event, context, callback);
    case '/admin/apps/{id}':
      if (event.httpMethod === 'GET') {
        return detail(event, context, callback);
      }
      return update(event, context, callback);
    case '/admin/apps':
      return list(event, context, callback);
    default:
      throw error.notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
