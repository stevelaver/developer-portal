'use strict';
var aws = require('aws-sdk');

var identity = module.exports;

identity.getUser = function(region, token, callback) {
  var provider = new aws.CognitoIdentityServiceProvider({region: region});
  provider.getUser({AccessToken: token}, function(err, data) {
    if (err) return callback(err);

    var user = {};
    data.UserAttributes.map(function (obj) {
      user[obj.Name] = obj.Value;
    });

    return callback(null, {
      id: user.sub,
      email: data.Username,
      name: user.name,
      vendor: user.profile,
      isAdmin: user['custom:isAdmin'] === '1'
    });
  });
};

identity.getAdmin = function(region, token, callback) {
  identity.getUser(region, token, function(err, data) {
    if (err) {
      return callback(err);
    }
    if (!data.isAdmin) {
      return callback(Error('[403] Forbidden'));
    }
    return callback(null, data);
  });
};