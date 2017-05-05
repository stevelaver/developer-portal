'use strict';

import Auth from '../app/auth';
import Services from '../lib/Services';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');
const joi = require('joi');

const db = require('../lib/db');
const request = require('../lib/request');

const services = new Services(process.env);
const app = new Auth(services, db, process.env, Services.getError());
const identity = Services.getIdentity();
const validation = Services.getValidation();


function login(event, context, callback) {
  validation.validate(event, {
    body: {
      email: joi.string().required().error(Error('Parameter email must be a string')),
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
    throw Services.getError().unprocessable('You have to pass either password or code and session');
  }
  return request.responseAuthPromise(
    promise,
    event,
    context,
    callback
  );
}

function logout(event, context, callback) {
  validation.validate(event, {
    auth: true,
  });

  return request.responseAuthPromise(
    app.logout(event.headers.Authorization),
    event,
    context,
    callback,
    204
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
        .error(Error('Parameter email is required and should have format of email address')),
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
    },
  });
  const body = JSON.parse(event.body);

  return request.responseAuthPromise(
    app.signUp(body.email, body.password, body.name)
      .then(() => null),
    event,
    context,
    callback,
    201
  );
}

function confirm(event, context, callback) {
  if (!_.has(event.pathParameters, 'code')) {
    throw Services.getError().badRequest('Parameter code is required');
  } else if (!_.has(event.pathParameters, 'email')) {
    throw Services.getError().badRequest('Parameter email is required');
  }

  return request.responseAuthPromise(
    app.confirm(event.pathParameters.email, event.pathParameters.code),
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
      content: 'Your account has been successfully confirmed. Now you should join a vendor or create a new one.',
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
    case '/auth/logout':
      return logout(event, context, callback);
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
      throw Services.getError().notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
