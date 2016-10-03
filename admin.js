'use strict';
var _ = require('lodash');
var async = require('async');
var aws = require('aws-sdk');
var vandium = require('vandium');
require('dotenv').config();


/**
 * Enable user
 */
module.exports.userEnable = vandium.createInstance({
  validation: {
    schema: {
      path: vandium.types.object().keys({
        email: vandium.types.email().error(Error('Parameter email must have format of email address'))
      })
    }
  }
}).handler(function(event, context, callback) {

  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});

  async.waterfall([
    function(cb) {
      provider.adminGetUser({
        UserPoolId: process.env.COGNITO_POOL_ID,
        Username: event.path.email
      }, function(err, data) {
        if (err) {
          return cb(err);
        }

        /*if (data.Enabled) {
          return cb(Error('[404] Already Enabled'));
        }*/

        return cb(null, data);
      });
    },
    function(user, cb) {
      provider.adminEnableUser({
        UserPoolId: process.env.COGNITO_POOL_ID,
        Username: event.path.email
      }, function(err) {
        return err ? cb(err) : cb(null, user);
      });
    },
    function(user, cb) {
      var vendor = _.get(_.find(user.UserAttributes, function(o) { return o.Name == 'profile'; }), 'Value', null);
      var ses = new aws.SES({apiVersion: '2010-12-01', region: process.env.REGION});
      ses.sendEmail({
        Source: process.env.SES_EMAIL,
        Destination: { ToAddresses: [event.path.email] },
        Message: {
          Subject: {
            Data: 'Welcome to Keboola Developer Portal'
          },
          Body: {
            Text: {
              Data: 'Your account in Keboola Developer Portal for vendor ' + vendor + ' has been approved'
            }
          }
        }
      }, function(err) {
        return cb(err);
      });
    }
  ], callback);
});


/**
 * Users List
 */
module.exports.users = vandium.createInstance({
  validation: {
    schema: {
      query: vandium.types.object().keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
        filter: vandium.types.string()
      })
    }
  }
}).handler(function(event, context, callback) {

  var filter = '';
  switch (event.query.filter) {
    case 'enabled':
      filter = 'status = "Enabled"';
      break;
    case 'disabled':
      filter = 'status = "Disabled"';
      break;
    case 'unconfirmed':
      filter = 'cognito:user_status = "Unconfirmed"';
      break;
    case 'confirmed':
      filter = 'cognito:user_status = "Confirmed"';
      break;
  }

  var provider = new aws.CognitoIdentityServiceProvider({region: process.env.REGION});
  provider.listUsers({
    UserPoolId: process.env.COGNITO_POOL_ID,
    Filter: filter
  }, function(err, data) {
    if (err) {
      return callback(err);
    }

    return callback(null, _.map(data.Users, function(item) {
      return {
        email: item.Username,
        name: _.get(_.find(item.Attributes, function(o) { return o.Name == 'name'; }), 'Value', null),
        vendor: _.get(_.find(item.Attributes, function(o) { return o.Name == 'profile'; }), 'Value', null),
        createdOn: item.UserCreateDate,
        isEnabled: item.Enabled,
        status: item.UserStatus,
        id: _.get(_.find(item.Attributes, function(o) { return o.Name == 'sub'; }), 'Value', null),
      };
    }));
  });
});