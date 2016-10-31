'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const joi = require('joi');
const moment = require('moment');
const mysql = require('mysql');
const notification = require('../lib/notification');
const request = require('../lib/request');
const validation = require('../lib/validation');

/**
 * Confirm
 */
const confirm = function (event, context, callback) {
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  async.waterfall([
    function (cb) {
      if (!_.has(event.pathParameters, 'code')) {
        cb(error.badRequest('Parameter code is required'));
      } else if (!_.has(event.pathParameters, 'email')) {
        cb(error.badRequest('Parameter email is required'));
      }
      cb();
    },
    function (cb) {
      provider.confirmSignUp({
        ClientId: env.COGNITO_CLIENT_ID,
        ConfirmationCode: event.pathParameters.code,
        Username: event.pathParameters.email,
      }, err => cb(error.authError(err)));
    },
    function (cb) {
      provider.adminDisableUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.pathParameters.email,
      }, err => cb(err));
    },
    function (cb) {
      provider.adminGetUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.pathParameters.email,
      }, cb);
    },
    function (userData, cb) {
      const user = identity.formatUser(userData);
      notification.setHook(env.SLACK_HOOK_URL, env.SERVICE_NAME);
      notification.approveUser(user, cb);
    },
  ], err => callback(err));
};
module.exports.confirmGet = (event, context, callback) => request.htmlErrorHandler(() => {
  confirm(event, context, (err) => {
    request.htmlResponse(err, {
      header: 'Account confirmation',
      content: 'Your account has been successfuly confirmed. Now you have to wait for approval from our staff.',
    }, event, context, callback);
  });
}, context, callback);
module.exports.confirmPost = (event, context, callback) => request.errorHandler(() => {
  confirm(event, context, (err) => {
    request.response(err, null, event, context, callback, 204);
  });
}, context, callback);


/**
 * Confirm Resend
 */
module.exports.confirmResend = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    body: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
      password: joi.string().required()
        .error(Error('Parameter password is required')),
    },
  });
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      provider.adminInitiateAuth({
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        ClientId: env.COGNITO_CLIENT_ID,
        UserPoolId: env.COGNITO_POOL_ID,
        AuthParameters: {
          USERNAME: event.body.email,
          PASSWORD: event.body.password,
        },
      }, cb);
    },
  ], (err) => {
    if (err && err.code === 'UserNotConfirmedException') {
      provider.resendConfirmationCode({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: event.body.email,
      }, err2 => request.response(err2, null, event, context, callback, 204));
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
}, context, callback);


/**
 * Forgot
 */
module.exports.forgot = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    path: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
    },
  });
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function () {
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
    },
  ], (err, res) => request.response(err, res, event, context, callback));
}, context, callback);


/**
 * Forgot Confirm
 */
module.exports.forgotConfirm = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    path: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
    },
    body: joi.object().keys({
      password: joi.string().required().min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
        .error(Error('Parameter newPassword is required, must have ' +
        'at least 8 characters and contain at least one lowercase letter, ' +
        'one uppercase letter and one number')),
      code: joi.string().required()
        .error(Error('Parameter code is required')),
    }),
  });
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function () {
      provider.confirmForgotPassword({
        ClientId: env.COGNITO_CLIENT_ID,
        ConfirmationCode: event.body.code,
        Password: event.body.password,
        Username: event.pathParameters.email,
      }, err => request.response(
        error.authError(err),
        null,
        event,
        context,
        callback,
        204
      ));
    },
  ], (err, res) => request.response(err, res, event, context, callback));
}, context, callback);


/**
 * Login
 */
module.exports.login = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    body: {
      email: joi.string().email().required()
        .error(Error('Parameter email is required and should have ' +
        'format of email address')),
      password: joi.string().required()
        .error(Error('Parameter password is required')),
    },
  });
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function () {
      provider.adminInitiateAuth({
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        ClientId: env.COGNITO_CLIENT_ID,
        UserPoolId: env.COGNITO_POOL_ID,
        AuthParameters: {
          USERNAME: event.body.email,
          PASSWORD: event.body.password,
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
    },
  ], (err, res) => request.response(err, res, event, context, callback));
}, context, callback);


/**
 * Profile
 */
module.exports.profile = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    auth: true,
  });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      identity.getUser(
        env.REGION,
        event.headers.Authorization,
        cb,
      );
    },
  ], (err, res) => request.response(err, res, event, context, callback));
}, context, callback);


/**
 * Profile Change
 */
module.exports.profileChange = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
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
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function () {
      provider.changePassword({
        PreviousPassword: event.body.oldPassword,
        ProposedPassword: event.body.newPassword,
        AccessToken: event.headers.Authorization,
      }, err => request.response(error.authError(err), null, event, context, callback, 204));
    },
  ], (err, res) => request.response(err, res, event, context, callback));
}, context, callback);


/**
 * Signup
 */
let db;
module.exports.signup = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
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
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });

  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      db.query(
        'SELECT * FROM `vendors` WHERE `id` = ?',
        [event.body.vendor],
        (err, result) => {
          if (err) return cb(err);

          if (result.length === 0) {
            return cb(error.notFound(`Vendor ${event.body.vendor} does not exist`));
          }

          return cb();
        }
      );
    },
    (cb) => {
      const provider = new aws.CognitoIdentityServiceProvider({
        region: env.REGION,
      });
      provider.signUp({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: event.body.email,
        Password: event.body.password,
        UserAttributes: [
          {
            Name: 'email',
            Value: event.body.email,
          },
          {
            Name: 'name',
            Value: event.body.name,
          },
          {
            Name: 'profile',
            Value: event.body.vendor,
          },
        ],
      }, err => cb(error.authError(err)));
    },
  ], (err) => {
    db.destroy();
    return request.response(err, null, event, context, callback, 201);
  });
}, context, (err, res) => {
  db.destroy();
  callback(err, res);
});
