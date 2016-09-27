'use strict';
var _ = require('lodash');
var aws = require('aws-sdk');
var vandium = require('vandium');
require('dotenv').config();


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