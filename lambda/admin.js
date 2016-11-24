'use strict';

import App from '../lib/app';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const db = require('../lib/db');
const email = require('../lib/email');
const error = require('../lib/error');
const identity = require('../lib/identity');
const joi = require('joi');
const Promise = require('bluebird');
const request = require('../lib/request');
const validation = require('../lib/validation');

const app = new App(db, process.env, error);
aws.config.setPromisesDependency(Promise);
email.init(process.env.REGION, process.env.SES_EMAIL_FROM);

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
    .then(() => identity.getAdmin(process.env.REGION, event.headers.Authorization))
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
    .then(() => identity.getAdmin(process.env.REGION, event.headers.Authorization))
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
  const cognito = new aws.CognitoIdentityServiceProvider({ region: process.env.REGION });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getAdmin(process.env.REGION, event.headers.Authorization))
    .then(() => app.makeUserAdmin(cognito, identity, event.pathParameters.email)),
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
  const cognito = new aws.CognitoIdentityServiceProvider({ region: process.env.REGION });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getAdmin(process.env.REGION, event.headers.Authorization))
    .then(() => app.enableUser(cognito, event.pathParameters.email))
    .then((userIn) => {
      const user = identity.formatUser(userIn);
      return email.send(
        user.email,
        'Welcome to Keboola Developer Portal',
        'Welcome to Keboola Developer Portal',
        `Your account in Keboola Developer Portal for vendor ${user.vendor} has been approved.`
      );
    }),
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
  const cognito = new aws.CognitoIdentityServiceProvider({ region: process.env.REGION });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getAdmin(process.env.REGION, event.headers.Authorization))
    .then(() => app.listUsers(
      cognito,
      _.has(event, 'queryStringParameters.filter')
        ? event.queryStringParameters.filter : null
    ))
    .then(data => _.map(data.Users, item => ({
      email: item.Username,
      name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', null),
      vendor: _.get(_.find(item.Attributes, o => (o.Name === 'profile')), 'Value', null),
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
