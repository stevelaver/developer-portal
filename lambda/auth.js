'use strict';

import Auth from '../app/auth';
import Identity from '../lib/identity';
import InitApp from '../lib/InitApp';
import Validation from '../lib/validation';
import Vendor from '../app/vendor';

require('longjohn');
require('babel-polyfill');
require('source-map-support').install();
const _ = require('lodash');
const joi = require('joi');
const jwt = require('jsonwebtoken');

const db = require('../lib/db');
const error = require('../lib/error');
const request = require('../lib/request');

const init = new InitApp(process.env);
const app = new Auth(init, db, process.env, error);
const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);


function login(event, context, callback) {
  validation.validate(event, {
    body: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have format of email address')),
      password: joi.string().error(Error('Parameter password must be a string')),
      code: joi.string().error(Error('Parameter code must be a string')),
      session: joi.string().error(Error('Parameter code must be a string')),
    },
  });

  const body = JSON.parse(event.body);
  let promise;
  if (_.has(body, 'password')) {
    promise = app.login(body.email, body.password);
  } else if (_.has(body, 'code') && _.has(body, 'session')) {
    promise = app.loginWithCode(body.email, body.code, body.session);
  } else {
    throw error.unprocessable('You have to pass either password or code and session');
  }
  return request.responseAuthPromise(
    promise,
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

function signup(event, context, callback) {
  validation.validate(event, {
    body: {
      name: joi.string().required()
        .error(Error('Parameter name is required')),
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have format of email address')),
      password: joi.string().required().min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
        .error(Error('Parameter password is required, it must have at least 8 characters and contain ' +
          'at least one lowercase letter, one uppercase letter and one number')),
      vendor: joi.alternatives().try(
        joi.string().required().error(Error('Parameter vendor is required and must be a string')),
        joi.object().required().keys({
          name: joi.string().max(64).required()
            .error(Error('Parameter vendor.name is required string with max length 64 when vendor is object')),
          address: joi.string().required()
            .error(Error('Parameter vendor.address is required string when vendor is object')),
          email: joi.string().email().required()
            .error(Error('Parameter vendor.email is required email address when vendor is object')),
        }),
      ),
    },
  });
  const body = JSON.parse(event.body);

  if (typeof body.vendor === 'object') {
    const vendorApp = new Vendor(init, db, process.env, error);
    return request.responseAuthPromise(
      app.signUpCreateVendor(vendorApp, body.email, body.password, body.name, body.vendor)
        .then(vendorId => init.getNotification().approveVendor(vendorId, body.vendor.name, {
          name: body.name,
          email: body.email,
        })),
      event,
      context,
      callback,
      204
    );
  }

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
      .then(user => init.getNotification().approveUser({
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

function enableMfa(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      phone: joi.string().required()
        .error(Error('Parameter phone is required and must be a string')),
    },
  });

  return request.responseAuthPromise(
    identity.getUser(event.headers.Authorization)
      .then(user => app.enableMfa(user.email, event.pathParameters.phone)),
    event,
    context,
    callback,
    204
  );
}

function confirmMfa(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      code: joi.string().required()
        .error(Error('Parameter code is required and must be a string')),
    },
  });
  return request.responseAuthPromise(
    app.confirmMfa(event.headers.Authorization, event.pathParameters.code),
    event,
    context,
    callback,
    204
  );
}


module.exports.auth = (event, context, callback) => request.errorHandler(() => {
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
    case '/auth/signup':
      return signup(event, context, callback);
    case '/auth/confirm/{email}/{code}':
      if (event.httpMethod === 'GET') {
        return confirmGet(event, context, callback);
      }
      return confirm(event, context, callback);
    case '/auth/confirm':
      return resend(event, context, callback);
    case '/auth/mfa/{phone}':
      return enableMfa(event, context, callback);
    case '/auth/mfa/confirm/{code}':
      return confirmMfa(event, context, callback);
    default:
      throw error.notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
