'use strict';

import App from '../lib/app';
import Email from '../lib/email';
import Identity from '../lib/identity';
import Validation from '../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const db = require('../lib/db');
const error = require('../lib/error');
const joi = require('joi');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const request = require('../lib/request');

aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({
  region: process.env.REGION,
});
const app = new App(db, process.env, error);
const email = new Email(
  new aws.SES({ apiVersion: '2010-12-01', region: process.env.REGION }),
  process.env.SES_EMAIL_FROM
);

const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);

/**
 * Approve app
 */
module.exports.appApprove = (event, context, callback) => request.errorHandler(() => {
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
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Apps List
 */
module.exports.apps = (event, context, callback) => request.errorHandler(() => {
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
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * App detail
 */
module.exports.appsDetail = (event, context, callback) => request.errorHandler(() => {
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
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Create app
 */
module.exports.appsCreate = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    body: validation.adminCreateAppSchema(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(user => app.insertAppByAdmin(
        JSON.parse(event.body),
        user
      )),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));

/**
 * Update app
 */
module.exports.appsUpdate = (event, context, callback) => request.errorHandler(() => {
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
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Make user admin
 */
module.exports.userMakeAdmin = (event, context, callback) => request.errorHandler(() => {
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
    .then(() => app.makeUserAdmin(cognito, Identity, event.pathParameters.email))
    .then(() => null),
    db,
    event,
    context,
    callback,
    204
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Enable user
 */
module.exports.userEnable = (event, context, callback) => request.errorHandler(() => {
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
}, event, context, (err, res) => db.endCallback(err, res, callback));


/**
 * Users List
 */
module.exports.users = (event, context, callback) => request.errorHandler(() => {
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
      name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', null),
      // TODO vendor: _.get(_.find(item.Attributes, o => (o.Name === 'profile')), 'Value', null),
      createdOn: item.UserCreateDate,
      isEnabled: item.Enabled,
      status: item.UserStatus,
      id: _.get(_.find(item.Attributes, o => (o.Name === 'sub')), 'Value', null),
    }))),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));

/**
 * Create vendor
 */
module.exports.vendorsCreate = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    body: validation.adminCreateVendor(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.createVendor(JSON.parse(event.body))),
    db,
    event,
    context,
    callback,
    204
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
