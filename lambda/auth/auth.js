'use strict';

import Auth from '../../lib/auth';
import Validation from '../../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const error = require('../../lib/error');
const identity = require('../../lib/identity');
const joi = require('joi');
const mysql = require('mysql');
const notification = require('../../lib/notification');
const Promise = require('bluebird');
const request = require('../../lib/request');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({
  region: process.env.REGION,
});
notification.setHook(process.env.SLACK_HOOK_URL, process.env.SERVICE_NAME);

const auth = new Auth(cognito, process.env, error);
const validation = new Validation(joi, error);

/**
 * Confirm
 */
const confirm = function (event, context, callback) {
  if (!_.has(event.pathParameters, 'code')) {
    throw error.badRequest('Parameter code is required');
  } else if (!_.has(event.pathParameters, 'email')) {
    throw error.badRequest('Parameter email is required');
  }

  return request.responseAuthPromise(
    auth.confirm(event.pathParameters.email, event.pathParameters.code)
    .then((userData) => {
      const user = identity.formatUser(userData);
      return notification.approveUser(user);
    }),
    event,
    context,
    callback,
    204
  );
};
module.exports.confirmGet = (event, context, callback) => request.htmlErrorHandler(() => {
  confirm(event, context, (err) => {
    request.htmlResponse(err, {
      header: 'Account confirmation',
      content: 'Your account has been successfuly confirmed. Now you have ' +
        'to wait for approval from our staff. Your account is disabled ' +
        'until then.',
    }, event, context, callback);
  });
}, event, context, callback);
module.exports.confirmPost = (event, context, callback) => request.errorHandler(() => {
  confirm(event, context, callback);
}, event, context, callback);


/**
 * Confirm Resend
 */
module.exports.confirmResend = (event, context, callback) => request.errorHandler(() => {
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
    auth.confirmResend(body.email, body.password),
    event,
    context,
    callback,
    204
  );
}, event, context, callback);


/**
 * Forgot
 */
module.exports.forgot = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    path: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
    },
  });

  return request.responseAuthPromise(
    auth.forgot(event.pathParameters.email),
    event,
    context,
    callback,
    204
  );
}, event, context, callback);


/**
 * Forgot Confirm
 */
module.exports.forgotConfirm = (event, context, callback) => request.errorHandler(() => {
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
    auth.confirmForgotPassword(
      event.pathParameters.email,
      body.password,
      body.code
    ),
    event,
    context,
    callback,
    204
  );
}, event, context, callback);


/**
 * Login
 */
module.exports.login = (event, context, callback) => request.errorHandler(() => {
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
    auth.login(body.email, body.password),
    event,
    context,
    callback
  );
}, event, context, callback);


/**
 * Profile
 */
module.exports.profile = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
  });

  return request.responseAuthPromise(
    identity.getUser(process.env.REGION, event.headers.Authorization),
    event,
    context,
    callback
  );
}, event, context, callback);


/**
 * Profile Change
 */
module.exports.profileChange = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    body: {
      oldPassword: joi.string().required()
        .error(Error('Parameter oldPassword is required')),
      newPassword: joi.string().required().min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
        .error(Error('Parameter newPassword is required, must have ' +
          'at least 8 characters and contain at least one lowercase ' +
          'letter, one uppercase letter and one number')),
    },
  });

  const body = JSON.parse(event.body);
  return request.responseAuthPromise(
    auth.changePassword(
      event.headers.Authorization,
      body.oldPassword,
      body.newPassword
    ),
    event,
    context,
    callback,
    204
  );
}, event, context, callback);


/**
 * Signup
 */
let db;
module.exports.signup = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    body: {
      name: joi.string().required()
        .error(Error('Parameter name is required')),
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
      password: joi.string().required().min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
        .error(Error('Parameter password is required, must have ' +
        'at least 8 characters and contain at least one lowercase letter, ' +
        'one uppercase letter and one number')),
      vendor: joi.string().required()
        .error(Error('Parameter vendor is required')),
    },
  });
  db = mysql.createConnection({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    ssl: process.env.RDS_SSL,
    port: process.env.RDS_PORT,
  });
  const body = JSON.parse(event.body);

  return request.responseAuthPromise(
    auth.signUp(
      db,
      body.email,
      body.password,
      body.name,
      body.vendor
    ),
    event,
    context,
    callback,
    204
  );
}, event, context, callback);
