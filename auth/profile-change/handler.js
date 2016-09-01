'use strict';
var aws = require('aws-sdk');
var vandium = require('vandium');

vandium.validation({
  body: vandium.types.object().keys({
    oldPassword: vandium.types.string().required().error(new Error('Parameter oldPassword is required')),
    newPassword: vandium.types.string().required().min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/)
      .error(new Error('Parameter newPassword is required, must have at least 8 characters and contain at least one '
        + 'lowercase letter, one uppercase letter, one number and one special character'))
  }),
  token: vandium.types.string().required()
});

module.exports.handler = vandium(function(event, context, callback) {
  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
  provider.changePassword({
    PreviousPassword: event.body.oldPassword,
    ProposedPassword: event.body.newPassword,
    AccessToken: event.token
  }, function(err) {
    return callback(err);
  });
});
