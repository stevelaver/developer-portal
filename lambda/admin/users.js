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
const cognito = new aws.CognitoIdentityServiceProvider({
  region: process.env.REGION,
});
const app = new App(db, Identity, process.env, error);
const email = new Email(
  new aws.SES({ apiVersion: '2010-12-01', region: process.env.REGION }),
  process.env.SES_EMAIL_FROM
);

const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);


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

function makeAdmin(event, context, callback) {
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

function addVendor(event, context, callback) {
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

function enable(event, context, callback) {
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


module.exports.users = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/admin/users':
      return list(event, context, callback);
    case '/admin/users/{email}/admin':
      return makeAdmin(event, context, callback);
    case '/admin/users/{email}/vendors/{vendor}':
      return addVendor(event, context, callback);
    case '/admin/users/{email}/enable':
      return enable(event, context, callback);
    default:
      throw error.notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
