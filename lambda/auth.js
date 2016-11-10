'use strict';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const mysql = require('mysql');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const joi = require('joi');
const moment = require('moment');
const notification = require('../lib/notification');
const Promise = require('bluebird');
const request = require('../lib/request');
const validation = require('../lib/validation');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);


/**
 * Confirm
 */
const confirm = function (event, context, callback) {
  if (!_.has(event.pathParameters, 'code')) {
    throw error.badRequest('Parameter code is required');
  } else if (!_.has(event.pathParameters, 'email')) {
    throw error.badRequest('Parameter email is required');
  }

  aws.config.setPromisesDependency(Promise);
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  provider.confirmSignUp({
    ClientId: env.COGNITO_CLIENT_ID,
    ConfirmationCode: event.pathParameters.code,
    Username: event.pathParameters.email,
  }).promise()
    .then(() => provider.adminDisableUser({
      UserPoolId: env.COGNITO_POOL_ID,
      Username: event.pathParameters.email,
    }).promise())
    .then(() => provider.adminGetUser({
      UserPoolId: env.COGNITO_POOL_ID,
      Username: event.pathParameters.email,
    }).promise())
    .then((userData) => {
      const user = identity.formatUser(userData);
      notification.setHook(env.SLACK_HOOK_URL, env.SERVICE_NAME);
      return notification.approveUser(user);
    })
    .then(() => request.response(null, null, event, context, callback, 204))
    .catch(err => callback(error.authError(err)));
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
  confirm(event, context, (err) => {
    request.response(err, null, event, context, callback, 204);
  });
}, event, context, callback);


/**
 * Confirm Resend
 */
module.exports.confirmResend = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    body: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
      password: joi.string().required()
        .error(Error('Parameter password is required')),
    },
  }));
  const body = JSON.parse(event.body);
  aws.config.setPromisesDependency(Promise);
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  provider.adminInitiateAuth({
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    ClientId: env.COGNITO_CLIENT_ID,
    UserPoolId: env.COGNITO_POOL_ID,
    AuthParameters: {
      USERNAME: body.email,
      PASSWORD: body.password,
    },
  }).promise()
  .then(() => request.response(null, null, event, context, callback, 204))
  .catch((err) => {
    if (err && err.code === 'UserNotConfirmedException') {
      provider.resendConfirmationCode({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: body.email,
      }).promise()
      .then(() => request.response(null, null, event, context, callback, 204))
      .catch(err2 => request.response(err2, null, event, context, callback));
    } else if (err && err.code === 'NotAuthorizedException') {
      return request.response(
        error.badRequest('Already confirmed'),
        null,
        event,
        context,
        callback
      );
    } else {
      return request.response(error.authError(err), null, event, context, callback);
    }
  });
}, event, context, callback);


/**
 * Forgot
 */
module.exports.forgot = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    path: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
    },
  }));
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  provider.forgotPassword({
    ClientId: env.COGNITO_CLIENT_ID,
    Username: event.pathParameters.email,
  }, err => request.response(
    error.authError(err),
    null,
    event,
    context,
    callback,
    204
  ));
}, event, context, callback);


/**
 * Forgot Confirm
 */
module.exports.forgotConfirm = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
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
  }));
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  const body = JSON.parse(event.body);
  provider.confirmForgotPassword({
    ClientId: env.COGNITO_CLIENT_ID,
    ConfirmationCode: body.code,
    Password: body.password,
    Username: event.pathParameters.email,
  }, err => request.response(
    error.authError(err),
    null,
    event,
    context,
    callback,
    204
  ));
}, event, context, callback);


/**
 * Login
 */
module.exports.login = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    body: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
      password: joi.string().required()
        .error(Error('Parameter password is required')),
    },
  }));
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  const body = JSON.parse(event.body);
  provider.adminInitiateAuth({
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    ClientId: env.COGNITO_CLIENT_ID,
    UserPoolId: env.COGNITO_POOL_ID,
    AuthParameters: {
      USERNAME: body.email,
      PASSWORD: body.password,
    },
  }, (err, data) => {
    if (err) {
      return request.response(error.authError(err), null, event, context, callback);
    }

    return request.response(null, {
      token: data.AuthenticationResult.AccessToken, // data.AuthenticationResult.IdToken,
      expires: moment().add(data.AuthenticationResult.ExpiresIn, 's').utc()
        .format(),
    }, event, context, callback);
  });
}, event, context, callback);


/**
 * Profile
 */
module.exports.profile = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    auth: true,
  }));
  identity.getUser(
    env.REGION,
    event.headers.Authorization,
    (err, res) => request.response(err, res, event, context, callback),
  );
}, event, context, callback);


/**
 * Profile Change
 */
module.exports.profileChange = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
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
  }));
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  const body = JSON.parse(event.body);
  provider.changePassword({
    PreviousPassword: body.oldPassword,
    ProposedPassword: body.newPassword,
    AccessToken: event.headers.Authorization,
  }, err => request.response(error.authError(err), null, event, context, callback, 204));
}, event, context, callback);


/**
 * Signup
 */
let db;
module.exports.signup = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
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
  }));
  db = mysql.createConnection({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  const body = JSON.parse(event.body);

  aws.config.setPromisesDependency(Promise);
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });

  db.queryAsync('SELECT * FROM `vendors` WHERE `id` = ?', [body.vendor])
  .spread(rows => new Promise((resolve, reject) => {
    if (!rows) {
      reject(error.notFound(`Vendor ${body.vendor} does not exist`));
    } else {
      resolve();
    }
  }))
  .then(() => provider.signUp({
    ClientId: env.COGNITO_CLIENT_ID,
    Username: body.email,
    Password: body.password,
    UserAttributes: [
      {
        Name: 'email',
        Value: body.email,
      },
      {
        Name: 'name',
        Value: body.name,
      },
      {
        Name: 'profile',
        Value: body.vendor,
      },
    ],
  }).promise())
  .then(() => {
    db.end();
    return request.response(null, null, event, context, callback, 201);
  })
  .catch((err) => {
    db.end();
    return request.response(error.authError(err), null, event, context, callback);
  });
}, event, context, (err, res) => {
  if (db) {
    db.end();
  }
  callback(err, res);
});
