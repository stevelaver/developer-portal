'use strict';

import Identity from '../../lib/identity';
import Notification from '../../lib/notification';
import Login from '../../app/login';
import Validation from '../../lib/validation';
import Vendor from '../../app/vendor';

require('babel-polyfill');
const joi = require('joi');
const requestLib = require('request-promise-lite');

const aws = require('aws-sdk');
const jwt = require('jsonwebtoken');

const db = require('../../lib/db');
const error = require('../../lib/error');
const request = require('../../lib/request');

aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({
  region: process.env.REGION,
});

const app = new Login(cognito, db, process.env, error);
const identity = new Identity(jwt, error);
const notification = new Notification(
  requestLib,
  process.env.SLACK_HOOK_URL,
  process.env.SERVICE_NAME
);
const validation = new Validation(joi, error);


function login(event, context, callback) {
  validation.validate(event, {
    body: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
          'format of email address')),
      password: joi.string().required()
        .error(Error('Parameter password is required')),
    },
  });

  const body = JSON.parse(event.body);
  return request.responseAuthPromise(
    app.login(body.email, body.password),
    event,
    context,
    callback
  );
}

function refreshToken(event, context, callback) {
  validation.validate(event, {
    auth: true,
  });

  return request.responseAuthPromise(
    app.refreshToken(event.headers.Authorization),
    event,
    context,
    callback
  );
}

function forgot(event, context, callback) {
  validation.validate(event, {
    path: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
          'format of email address')),
    },
  });

  return request.responseAuthPromise(
    app.forgot(event.pathParameters.email),
    event,
    context,
    callback,
    204
  );
}

function forgotConfirm(event, context, callback) {
  validation.validate(event, {
    path: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
          'format of email address')),
    },
    body: {
      password: joi.string().required().min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
        .error(Error('Parameter newPassword is required, must have ' +
          'at least 8 characters and contain at least one lowercase letter, ' +
          'one uppercase letter and one number')),
      code: joi.string().required()
        .error(Error('Parameter code is required')),
    },
  });

  const body = JSON.parse(event.body);
  return request.responseAuthPromise(
    app.confirmForgotPassword(
      event.pathParameters.email,
      body.password,
      body.code
    ),
    event,
    context,
    callback,
    204
  );
}

function profile(event, context, callback) {
  validation.validate(event, {
    auth: true,
  });

  return request.responseAuthPromise(
    identity.getUser(event.headers.Authorization),
    event,
    context,
    callback
  );
}

function joinVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required()
        .error(Error('Parameter vendor is required and must be a string')),
    },
  });

  return request.responsePromise(
    identity.getUser(event.headers.Authorization)
      .then((user) => {
        if (user.isAdmin) {
          const vendor = new Vendor(db, process.env, error);
          return vendor.join(cognito, Identity, user, event.pathParameters.vendor);
        }
        return notification.approveJoinVendor({
          email: user.email,
          vendor: event.pathParameters.vendor,
        });
      }),
    event,
    context,
    callback,
    204
  );
}

module.exports.login = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/auth/login':
      return login(event, context, callback);
    case '/auth/token':
      return refreshToken(event, context, callback);
    case '/auth/forgot/{email}':
      return forgot(event, context, callback);
    case '/auth/forgot/{email}/confirm':
      return forgotConfirm(event, context, callback);
    case '/auth/profile':
      return profile(event, context, callback);
    case '/auth/vendors/{vendor}':
      return joinVendor(event, context, callback);
    default:
      throw error.notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
