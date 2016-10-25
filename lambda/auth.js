'use strict';

require('babel-polyfill');
const async = require('async');
const aws = require('aws-sdk');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const moment = require('moment');
const mysql = require('mysql');
const request = require('../lib/request');
const vandium = require('vandium');

/**
 * Confirm
 */
module.exports.confirm = vandium.createInstance({
  validation: {
    schema: {
      pathParameters: vandium.types.object().keys({
        email: vandium.types.string().required()
          .error(Error('Parameter email is required and should have ' +
          'format of email address')),
        code: vandium.types.string().required()
          .error(Error('Parameter code is required')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  async.waterfall([
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
  ], (err) => {
    if (err) {
      return request.response(err, null, event, context, callback);
    }

    // @TODO SNS message User ${event.pathParameters.email} requests approval
    return request.response(null, null, event, context, callback, 204);
  });
}, context, callback));


/**
 * Confirm Resend
 */
module.exports.confirmResend = vandium.createInstance({
  validation: {
    schema: {
      body: vandium.types.object().keys({
        email: vandium.types.string().required()
          .error(Error('Parameter email is required and should have ' +
          'format of email address')),
        password: vandium.types.string().required()
          .error(Error('Parameter password is required')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  provider.adminInitiateAuth({
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    ClientId: env.COGNITO_CLIENT_ID,
    UserPoolId: env.COGNITO_POOL_ID,
    AuthParameters: {
      USERNAME: event.body.email,
      PASSWORD: event.body.password,
    },
  }, (err) => {
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
}, context, callback));


/**
 * Forgot
 */
module.exports.forgot = vandium.createInstance({
  validation: {
    schema: {
      pathParameters: vandium.types.object().allow(null).keys({
        email: vandium.types.string().required()
          .error(Error('Parameter email is required and should have ' +
          'format of email address')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
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
}, context, callback));


/**
 * Forgot Confirm
 */
module.exports.forgotConfirm = vandium.createInstance({
  validation: {
    schema: {
      pathParameters: vandium.types.object().allow(null).keys({
        email: vandium.types.string().required()
          .error(Error('Parameter email is required and should have ' +
          'format of email address')),
      }),
      body: vandium.types.object().keys({
        password: vandium.types.string().required().min(8)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
          .error(Error('Parameter newPassword is required, must have ' +
          'at least 8 characters and contain at least one lowercase letter, ' +
          'one uppercase letter and one number')),
        code: vandium.types.string().required()
          .error(Error('Parameter code is required')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
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
}, context, callback));


/**
 * Login
 */
module.exports.login = vandium.createInstance({
  validation: {
    schema: {
      body: vandium.types.object().keys({
        email: vandium.types.email().required()
          .error(Error('Parameter email is required and should have ' +
          'format of email address')),
        password: vandium.types.string().required()
          .error(Error('Parameter password is required')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
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
}, context, callback));


/**
 * Profile
 */
module.exports.profile = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  identity.getUser(
    env.REGION,
    event.headers.Authorization,
    (err, res) => request.response(err, res, event, context, callback)
  );
}, context, callback));


/**
 * Profile Change
 */
module.exports.profileChange = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      body: vandium.types.object().keys({
        oldPassword: vandium.types.string().required()
          .error(Error('Parameter oldPassword is required')),
        newPassword: vandium.types.string().required().min(8)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
          .error(Error('Parameter newPassword is required, must have ' +
            'at least 8 characters and contain at least one lowercase ' +
            'letter, one uppercase letter and one number')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  const provider = new aws.CognitoIdentityServiceProvider({
    region: env.REGION,
  });
  provider.changePassword({
    PreviousPassword: event.body.oldPassword,
    ProposedPassword: event.body.newPassword,
    AccessToken: event.headers.Authorization,
  }, err => request.response(error.authError(err), null, event, context, callback, 204));
}, context, callback));


/**
 * Signup
 */
let db;
module.exports.signup = vandium.createInstance({
  validation: {
    schema: {
      body: vandium.types.object().keys({
        name: vandium.types.string().required()
          .error(Error('Parameter name is required')),
        email: vandium.types.email().required()
          .error(Error('Parameter email is required and should have ' +
          'format of email address')),
        password: vandium.types.string().required().min(8)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
          .error(Error('Parameter password is required, must have ' +
          'at least 8 characters and contain at least one lowercase letter, ' +
          'one uppercase letter and one number')),
        vendor: vandium.types.string().required()
          .error(Error('Parameter vendor is required')),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
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
}));

module.exports.emailTrigger = function (event, context, callback) {
  const newEvent = event;
  switch (event.triggerSource) {
    case 'CustomMessage_SignUp':
      newEvent.response.emailSubject = 'Welcome to Keboola Developer Portal';
      newEvent.response.emailMessage = `Thank you for signing up. Confirm your email using this link: ${env.API_ENDPOINT}/auth/confirm/${event.userName}/${event.request.codeParameter}`;
      break;
    case 'CustomMessage_ForgotPassword':
      newEvent.response.emailSubject = 'Forgot Password to Keboola Developer Portal';
      newEvent.response.emailMessage = `Your confirmation code is ${event.request.codeParameter}`;
      break;
    case 'CustomMessage_ResendCode':
      newEvent.response.emailSubject = 'Confirmation code for Keboola Developer Portal';
      newEvent.response.emailMessage = `Confirm your email using this link: ${env.API_ENDPOINT}/auth/confirm/${event.userName}/${event.request.codeParameter}`;
      break;
    default:
  }
  callback(null, newEvent);
};
