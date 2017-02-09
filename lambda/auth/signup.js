'use strict';

import Identity from '../../lib/identity';
import Notification from '../../lib/notification';
import Signup from '../../app/signup';
import Validation from '../../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const joi = require('joi');
const requestLib = require('request-promise-lite');

const db = require('../../lib/db');
const error = require('../../lib/error');
const request = require('../../lib/request');

aws.config.setPromisesDependency(Promise);
const cognito = new aws.CognitoIdentityServiceProvider({
  region: process.env.REGION,
});

const app = new Signup(cognito, db, process.env, error);
const notification = new Notification(
  requestLib,
  process.env.SLACK_HOOK_URL,
  process.env.SERVICE_NAME
);
const validation = new Validation(joi, error);


function signup(event, context, callback) {
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
  const body = JSON.parse(event.body);

  return request.responseAuthPromise(
    app.signUp(body.email, body.password, body.name, body.vendor),
    event,
    context,
    callback,
    204
  );
}

function confirm(event, context, callback) {
  if (!_.has(event.pathParameters, 'code')) {
    throw error.badRequest('Parameter code is required');
  } else if (!_.has(event.pathParameters, 'email')) {
    throw error.badRequest('Parameter email is required');
  }

  return request.responseAuthPromise(
    app.confirm(event.pathParameters.email, event.pathParameters.code)
      .then(data => cognito.adminGetUser({
        UserPoolId: process.env.COGNITO_POOL_ID,
        Username: data.Username,
      }).promise())
      .then(user => Identity.formatUser(user))
      .then(user => notification.approveUser({
        name: user.name,
        email: event.pathParameters.email,
        vendors: user.vendors,
      })),
    event,
    context,
    callback,
    204
  );
}

function confirmGet(event, context, callback) {
  return confirm(event, context, (err) => {
    request.htmlResponse(err, {
      header: 'Account confirmation',
      content: 'Your account has been successfully confirmed. Now you have ' +
      'to wait for approval from our staff. Your account is disabled ' +
      'until then.',
    }, event, context, callback);
  });
}

function resend(event, context, callback) {
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
    app.resend(body.email, body.password),
    event,
    context,
    callback,
    204
  );
}

module.exports.signup = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/auth/signup':
      return signup(event, context, callback);
    case '/auth/confirm/{email}/{code}':
      if (event.httpMethod === 'GET') {
        return confirmGet(event, context, callback);
      }
      return confirm(event, context, callback);
    case '/auth/confirm':
      return resend(event, context, callback);
    default:
      throw error.badRequest();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
