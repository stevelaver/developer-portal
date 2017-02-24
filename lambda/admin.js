'use strict';

import App from '../lib/app';
import Email from '../lib/email';
import Identity from '../lib/identity';
import Validation from '../lib/validation';
import Vendor from '../app/vendor';

require('longjohn');
require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const diff = require('deep-diff').diff;
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
    query: {
      filter: joi.string(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.listUsers(
        cognito,
        _.has(event, 'queryStringParameters.filter')
          ? event.queryStringParameters.filter : null
      ))
      .then(data => _.map(data.Users, item => ({
        email: item.Username,
        name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', ''),
        vendors: _.get(_.find(item.Attributes, o => (o.Name === 'profile')), 'Value', '').split(','),
        createdOn: item.UserCreateDate,
        isEnabled: item.Enabled,
        status: item.UserStatus,
      }))),
    db,
    event,
    context,
    callback
  );
}

function makeUserAdmin(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      email: joi.string().email()
        .error(Error('Parameter email must have format of email address')),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.makeUserAdmin(cognito, event.pathParameters.email))
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
    path: {
      email: joi.string().email()
        .error(Error('Parameter email must have format of email address')),
      vendor: joi.string()
        .error(Error('Parameter vendor must be a string')),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.addUserToVendor(
        cognito,
        event.pathParameters.email,
        event.pathParameters.vendor
      ))
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
    path: {
      email: joi.string().email()
        .error(Error('Parameter email must have format of email address')),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.enableUser(cognito, event.pathParameters.email))
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

function listApps(event, context, callback) {
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
        diff,
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
    body: validation.adminCreateVendor(),
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
    default:
      throw error.notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
