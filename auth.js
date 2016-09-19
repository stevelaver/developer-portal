'use strict';
require('dotenv').config();

var async = require('async');
var aws = require('aws-sdk');
var identity = require('lib/identity');
var moment = require('moment');
var mysql = require('mysql');
const vandium = require('vandium');


/**
 * Confirm
 */
module.exports.confirm = vandium.createInstance({
  validation: {
    path: vandium.types.object().keys({
      email: vandium.types.string().required().error(new Error("[422] Parameter email is required and should have " +
        "format of email address")),
      code: vandium.types.string().required().error(new Error("[422] Parameter code is required"))
    })
  }
}).handler(function(event, context, callback) {
  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
  async.waterfall([
    function (callbackLocal) {
      provider.confirmSignUp({
        ClientId: process.env.COGNITO_CLIENT_ID,
        ConfirmationCode: event.path.code,
        Username: event.path.email
      }, function(err) {
        return callbackLocal(err);
      });
    },
    function(callbackLocal) {
      provider.adminDisableUser({
        UserPoolId: process.env.COGNITO_POOL_ID,
        Username: event.path.email
      }, function(err) {
        return callbackLocal(err);
      });
    }
  ], function (err) {
    if (err) return callback(err);

    var ses = new aws.SES({apiVersion: '2010-12-01', region: process.env.REGION});
    ses.sendEmail({
      Source: process.env.SES_EMAIL,
      Destination: { ToAddresses: [process.env.SES_EMAIL] },
      Message: {
        Subject: {
          Data: '[dev-portal] User ' + event.path.email + ' requests approval'
        },
        Body: {
          Text: {
            Data: 'User ' + event.path.email + ' just signed up'
          }
        }
      }
    }, function(err) {
      return callback(err);
    });
  });
});


/**
 * Confirm Resend
 */
module.exports.confirmResend = vandium.createInstance({
  validation: {
    body: vandium.types.object().keys({
      email: vandium.types.string().required().error(new Error("Parameter email is required and should have format " +
        "of email address")),
      code: vandium.types.string().required().error(new Error("Parameter code is required"))
    })
  }
}).handler(function(event, context, callback) {
  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
  provider.adminInitiateAuth({
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID,
    UserPoolId: process.env.COGNITO_POOL_ID,
    AuthParameters: {
      USERNAME: event.body.email,
      PASSWORD: event.body.password
    }
  }, function(err) {
    if (!err || err.code === 'NotAuthorizedException') {
      return callback(Error('Already confirmed'));
    } else {
      if (err.code === 'UserNotConfirmedException') {
        provider.resendConfirmationCode({
          ClientId: process.env.COGNITO_CLIENT_ID,
          Username: event.body.email
        }, function(err) {
          return callback(err);
        });
      } else {
        return callback(err);
      }
    }
  });
});


/**
 * Forgot
 */
module.exports.forgot = vandium.createInstance({
  validation: {
    path: vandium.types.object().keys({
      email: vandium.types.string().required().error(new Error("Parameter email is required and should have format " +
        "of email address"))
    })
  }
}).handler(function(event, context, callback) {
  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
  provider.forgotPassword({
    ClientId: process.env.COGNITO_CLIENT_ID,
    Username: event.path.email
  }, function(err) {
    return callback(err);
  });
});


/**
 * Forgot Confirm
 */
module.exports.forgotConfirm = vandium.createInstance({
  validation: {
    path: vandium.types.object().keys({
      email: vandium.types.string().required().error(new Error('Parameter email is required and should have format ' +
        'of email address')),
    }),
    body: vandium.types.object().keys({
      password: vandium.types.string().required().error(new Error('Parameter password is required')),
      code: vandium.types.string().required().error(new Error('Parameter code is required'))
    })
  }
}).handler(function(event, context, callback) {
  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
  provider.confirmForgotPassword({
    ClientId: process.env.COGNITO_CLIENT_ID,
    ConfirmationCode: event.body.code,
    Password: event.body.password,
    Username: event.path.email
  }, function(err) {
    return callback(err);
  });
});


/**
 * Login
 */
module.exports.login = vandium.createInstance({
  validation: {
    body: vandium.types.object().keys({
      email: vandium.types.email().required().error(new Error("Parameter email is required and should have format " +
        "of email address")),
      password: vandium.types.string().required().error(new Error("Parameter password is required"))
    })
  }
}).handler(function(event, context, callback) {
  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
  provider.adminInitiateAuth({
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID,
    UserPoolId: process.env.COGNITO_POOL_ID,
    AuthParameters: {
      USERNAME: event.body.email,
      PASSWORD: event.body.password
    }
  }, function(err, data) {
    if (err) {
      return callback(err);
    }

    return callback(null, {
      token: data.AuthenticationResult.AccessToken, //data.AuthenticationResult.IdToken,
      expires: moment().add(data.AuthenticationResult.ExpiresIn, 's').utc().format()
    });
  });
});


/**
 * Profile
 */
module.exports.profile = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    })
  }
}).handler(function(event, context, callback) {
  identity.getUser(event.headers.Authorization, callback);
});


/**
 * Profile Change
 */
module.exports.profileChange = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    }),
    body: vandium.types.object().keys({
      oldPassword: vandium.types.string().required().error(new Error('Parameter oldPassword is required')),
      newPassword: vandium.types.string().required().min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/)
        .error(new Error('Parameter newPassword is required, must have at least 8 characters and contain at least one '
          + 'lowercase letter, one uppercase letter, one number and one special character'))
    })
  }
}).handler(function(event, context, callback) {
  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
  provider.changePassword({
    PreviousPassword: event.body.oldPassword,
    ProposedPassword: event.body.newPassword,
    AccessToken: event.headers.Authorization
  }, function(err) {
    return callback(err);
  });
});


/**
 * Signup
 */
module.exports.signup = vandium.createInstance({
  validation: {
    body: vandium.types.object().keys({
      name: vandium.types.string().required().error(new Error('Parameter name is required')),
      email: vandium.types.email().required().error(new Error('Parameter email is required and should have format ' +
        'of email address')),
      password: vandium.types.string().required().min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/)
        .error(new Error('Parameter password is required, must have at least 8 characters and contain at least one '
          + 'lowercase letter, one uppercase letter, one number and one special character')),
      vendor: vandium.types.string().required().error(new Error('Parameter vendor is required'))
    })
  }
}).handler(function(event, context, callback) {
  var db = mysql.createConnection({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    ssl: 'Amazon RDS'
  });

  async.waterfall([
    function(callbackLocal) {
      db.query('SELECT * FROM `vendors` WHERE `id` = ?', [event.body.vendor], function(err, result) {
        if (err) return callbackLocal(err);

        if (result.length === 0) {
          return callbackLocal(Error('Vendor ' + id + ' does not exist'));
        }

        return callbackLocal();
      });
    },
    function(callbackLocal) {
      var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
      provider.signUp({
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: event.body.email,
        Password: event.body.password,
        UserAttributes: [
          {
            Name: 'email',
            Value: event.body.email
          },
          {
            Name: 'name',
            Value: event.body.name
          },
          {
            Name: 'profile',
            Value: event.body.vendor
          }
        ]
      }, function(err) {
        return callbackLocal(err);
      });
    }
  ], function(err) {
    db.destroy();
    return callback(err);
  });
});
