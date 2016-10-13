'use strict';

if (!global._babelPolyfill) {
  require('babel-polyfill');
}

const async = require('async');
const aws = require('aws-sdk');
const env = require('../env.yml');
const identity = require('../lib/identity');
const log = require('../lib/log');
const moment = require('moment');
const mysql = require('mysql');
const vandium = require('vandium');

/**
 * Confirm
 */
module.exports.confirm = vandium.createInstance({
  validation: {
    schema: {
      path: vandium.types.object().keys({
        email: vandium.types.string().required().error(Error('[422] Parameter email is required ' +
          'and should have format of email address')),
        code: vandium.types.string().required().error(Error('[422] Parameter code is required')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('authConfirm', event);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  async.waterfall([
    function (callbackLocal) {
      provider.confirmSignUp({
        ClientId: env.COGNITO_CLIENT_ID,
        ConfirmationCode: event.path.code,
        Username: event.path.email,
      }, (err) => {
        if (err.code === 'ExpiredCodeException' || err.code === 'CodeMismatchException') {
          err.message = '[404] Invalid verification code provided.';
        }
        return callbackLocal(err);
      });
    },
    function(callbackLocal) {
      provider.adminDisableUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.path.email,
      }, err => callbackLocal(err));
    },
  ], (err) => {
    if (err) return callback(err);

    // @TODO SNS message User ${event.path.email} requests approval
    callback();
  });
});


/**
 * Confirm Resend
 */
module.exports.confirmResend = vandium.createInstance({
  validation: {
    schema: {
      body: vandium.types.object().keys({
        email: vandium.types.string().required().error(Error('[422] Parameter email is required ' +
          'and should have format of email address')),
        password: vandium.types.string().required().error(Error('[422] Parameter password is required')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('authConfirmResend', event);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  provider.adminInitiateAuth({
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    ClientId: env.COGNITO_CLIENT_ID,
    UserPoolId: env.COGNITO_POOL_ID,
    AuthParameters: {
      USERNAME: event.body.email,
      PASSWORD: event.body.password,
    },
  }, (err) => {
    if (!err || err.code === 'NotAuthorizedException') {
      return callback(Error('[400] Already confirmed'));
    }
    if (err.code === 'UserNotConfirmedException') {
      provider.resendConfirmationCode({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: event.body.email,
      }, err2 => callback(err2));
    } else {
      return callback(err);
    }
  });
});


/**
 * Forgot
 */
module.exports.forgot = vandium.createInstance({
  validation: {
    schema: {
      path: vandium.types.object().keys({
        email: vandium.types.string().required().error(Error('[422] Parameter email is required and ' +
          'should have format of email address')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('authForgot', event);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  provider.forgotPassword({
    ClientId: env.COGNITO_CLIENT_ID,
    Username: event.path.email,
  }, err => callback(err));
});


/**
 * Forgot Confirm
 */
module.exports.forgotConfirm = vandium.createInstance({
  validation: {
    schema: {
      path: vandium.types.object().keys({
        email: vandium.types.string().required().error(Error('[422] Parameter email is required and ' +
          'should have format of email address')),
      }),
      body: vandium.types.object().keys({
        password: vandium.types.string().required().min(8)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
          .error(Error('[422] Parameter newPassword is required, must have at least 8 characters '
            + 'and contain at least one lowercase letter, one uppercase letter and one number')),
        code: vandium.types.string().required().error(Error('[422] Parameter code is required')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('authForgotConfirm', event);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  provider.confirmForgotPassword({
    ClientId: env.COGNITO_CLIENT_ID,
    ConfirmationCode: event.body.code,
    Password: event.body.password,
    Username: event.path.email,
  }, (err) => {
    if (err.code === 'ExpiredCodeException' || err.code === 'CodeMismatchException') {
      err.message = '[404] Invalid verification code provided.';
    }
    return callback(err);
  });
});


/**
 * Login
 */
module.exports.login = vandium.createInstance({
  validation: {
    schema: {
      body: vandium.types.object().keys({
        email: vandium.types.email().required().error(Error('[422] Parameter email is required ' +
          'and should have format of email address')),
        password: vandium.types.string().required().error(Error('[422] Parameter password is required')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('authLogin', event);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
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
      err.message = `[401] ${err.message}`;
      return callback(err);
    }

    return callback(null, {
      token: data.AuthenticationResult.AccessToken, //data.AuthenticationResult.IdToken,
      expires: moment().add(data.AuthenticationResult.ExpiresIn, 's').utc().format(),
    });
  });
});


/**
 * Profile
 */
module.exports.profile = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('authProfile', event);
  identity.getUser(env.REGION, event.headers.Authorization, callback);
});


/**
 * Profile Change
 */
module.exports.profileChange = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required')),
      }),
      body: vandium.types.object().keys({
        oldPassword: vandium.types.string().required().error(Error('[422] Parameter oldPassword is required')),
        newPassword: vandium.types.string().required().min(8)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
          .error(Error('[422] Parameter newPassword is required, must have at least 8 characters '
            + 'and contain at least one lowercase letter, one uppercase letter and one number')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('authProfileChange', event);
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  provider.changePassword({
    PreviousPassword: event.body.oldPassword,
    ProposedPassword: event.body.newPassword,
    AccessToken: event.headers.Authorization,
  }, err => callback(err));
});


/**
 * Signup
 */
module.exports.signup = vandium.createInstance({
  validation: {
    schema: {
      body: vandium.types.object().keys({
        name: vandium.types.string().required().error(Error('[422] Parameter name is required')),
        email: vandium.types.email().required().error(Error('[422] Parameter email is required ' +
          'and should have format of email address')),
        password: vandium.types.string().required().min(8)
          .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/)
          .error(Error('[422] Parameter password is required, must have at least 8 characters '
            + 'and contain at least one lowercase letter, one uppercase letter and one number')),
        vendor: vandium.types.string().required().error(Error('[422] Parameter vendor is required')),
      }),
    },
  },
}).handler((event, context, callback) => {
  log.start('authSignup', event);
  const db = mysql.createConnection({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
  });

  async.waterfall([
    function(callbackLocal) {
      db.query('SELECT * FROM `vendors` WHERE `id` = ?', [event.body.vendor], (err, result) => {
        if (err) return callbackLocal(err);

        if (result.length === 0) {
          return callbackLocal(Error(`[400] Vendor ${id} does not exist`));
        }

        return callbackLocal();
      });
    },
    (callbackLocal) => {
      const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
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
      }, err => callbackLocal(err));
    },
  ], (err) => {
    db.destroy();
    return callback(err);
  });
});

module.exports.emailTrigger = function(event, context, callback) {
  switch (event.triggerSource) {
    case 'CustomMessage_SignUp':
      event.response.emailSubject = 'Welcome to Keboola Developer Portal';
      event.response.emailMessage = `Thank you for signing up. Confirm your email using this link: https://m8pbt5jpi8.execute-api.us-east-1.amazonaws.com/dev/auth/confirm/${event.userName}/${event.request.codeParameter}`;
      break;
    case 'CustomMessage_ForgotPassword':
      event.response.emailSubject = 'Forgot Password to Keboola Developer Portal';
      event.response.emailMessage = `Your confirmation code is ${event.request.codeParameter}`;
      break;
    case 'CustomMessage_ResendCode':
      event.response.emailSubject = 'Confirmation code for Keboola Developer Portal';
      event.response.emailMessage = `Confirm your email using this link: https://m8pbt5jpi8.execute-api.us-east-1.amazonaws.com/dev/auth/confirm/${event.userName}/${event.request.codeParameter}`;
      break;
  }
  callback(null, event);
};
