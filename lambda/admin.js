'use strict';

import AdminUser from '../app/adminUser';
import App from '../lib/app';
import Email from '../lib/email';
import Identity from '../lib/identity';
import Validation from '../lib/validation';
import Vendor from '../app/vendor';

require('longjohn');
require('babel-polyfill');
require('source-map-support').install();
const _ = require('lodash');
const aws = require('aws-sdk');
const joiBase = require('joi');
const joiExtension = require('joi-date-extensions');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');

const db = require('../lib/db');
const error = require('../lib/error');
const request = require('../lib/request');


aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({
  region: process.env.REGION,
});
const app = new App(db, Identity, process.env, error);
const email = new Email(
  new aws.SES({ apiVersion: '2010-12-01', region: process.env.REGION }),
  process.env.SES_EMAIL_FROM
);
const identity = new Identity(jwt, error);
const joi = joiBase.extend(joiExtension);
const validation = new Validation(joi, error);
const vendorApp = new Vendor(db, process.env, error);


function listUsers(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    query: ['filter'],
  });

  const adminUser = new AdminUser(cognito, db, Identity, process.env, error);
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => adminUser.list(_.get(event, 'queryStringParameters.filter', null))),
    db,
    event,
    context,
    callback
  );
}

function makeUserAdmin(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['email'],
  });

  const adminUser = new AdminUser(cognito, db, Identity, process.env, error);
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => adminUser.makeAdmin(event.pathParameters.email))
      .then(() => null),
    db,
    event,
    context,
    callback,
    204
  );
}

function addUserToVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['email', 'vendor'],
  });

  const adminUser = new AdminUser(cognito, db, Identity, process.env, error);
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => adminUser.addToVendor(event.pathParameters.email, event.pathParameters.vendor))
      .then(() => null),
    db,
    event,
    context,
    callback,
    204
  );
}

function enableUser(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['email'],
  });

  const adminUser = new AdminUser(cognito, db, Identity, process.env, error);
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => adminUser.enable(event.pathParameters.email))
      .then(() => email.send(
        event.pathParameters.email,
        'Welcome to Keboola Developer Portal',
        'Welcome to Keboola Developer Portal',
        'Your account in Keboola Developer Portal has been approved.'
      ))
      .then(() => null),
    db,
    event,
    context,
    callback,
    204
  );
}

function approveApp(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['id'],
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

function listApps(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    query: ['filter'],
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

function detailApp(event, context, callback) {
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

function updateApp(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['id'],
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
    callback,
    204
  );
}

function listAppChanges(event, context, callback) {
  validation.validate(event, {
    auth: true,
    query: {
      since: joi.date().format('YYYY-MM-DD')
        .error(Error('Parameter since must be a date in format YYYY-MM-DD')),
      until: joi.date().format('YYYY-MM-DD')
        .error(Error('Parameter until must be a date format YYYY-MM-DD')),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.listAppChanges(
        _.get(event, 'queryStringParameters.since', null),
        _.get(event, 'queryStringParameters.until', null)
      )),
    db,
    event,
    context,
    callback
  );
}

function createVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    body: validation.adminCreateVendorSchema(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => vendorApp.create(JSON.parse(event.body))),
    db,
    event,
    context,
    callback,
    201
  );
}

function approveVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    body: {
      newId: validation.validateStringMaxLength('id', 32),
    },
    path: ['vendor'],
  });

  const body = JSON.parse(event.body);
  const adminUser = new AdminUser(cognito, db, Identity, process.env, error);
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => vendorApp.approve(event.pathParameters.vendor, _.get(body, 'newId', null)))
      .then((user) => {
        if (_.has(body, 'newId') && user) {
          return adminUser.addToVendor(user, body.newId)
            .then(() => adminUser.removeFromVendor(user, event.pathParameters.vendor));
        }
      })
      .then(() => null),
    db,
    event,
    context,
    callback,
    201
  );
}


module.exports.admin = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/admin/users':
      return listUsers(event, context, callback);
    case '/admin/users/{email}/admin':
      return makeUserAdmin(event, context, callback);
    case '/admin/users/{email}/vendors/{vendor}':
      return addUserToVendor(event, context, callback);
    case '/admin/users/{email}/enable':
      return enableUser(event, context, callback);
    case '/admin/apps/{id}/approve':
      return approveApp(event, context, callback);
    case '/admin/apps/{id}':
      if (event.httpMethod === 'GET') {
        return detailApp(event, context, callback);
      }
      return updateApp(event, context, callback);
    case '/admin/apps':
      return listApps(event, context, callback);
    case '/admin/changes':
      return listAppChanges(event, context, callback);
    case '/admin/vendors':
      return createVendor(event, context, callback);
    case '/admin/vendors/{vendor}/approve':
      return approveVendor(event, context, callback);
    default:
      throw error.notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
