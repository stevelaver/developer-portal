'use strict';

const aws = require('aws-sdk');
const error = require('./error');

const identity = module.exports;

identity.formatUser = function (user) {
  const attrs = {};
  user.UserAttributes.map((obj) => {
    attrs[obj.Name] = obj.Value;
    return user;
  });

  return {
    id: attrs.sub,
    email: user.Username,
    name: attrs.name,
    vendor: attrs.profile,
    isAdmin: attrs['custom:isAdmin'] === '1',
  };
};

identity.getUser = function (region, token, callback = null) {
  if (!callback) {
    aws.config.setPromisesDependency(Promise);
  }
  const provider = new aws.CognitoIdentityServiceProvider({ region });
  if (callback) {
    provider.getUser({ AccessToken: token }, (err, data) => {
      if (err) {
        return callback(err);
      }

      return callback(null, identity.formatUser(data));
    });
  } else {
    return provider.getUser({ AccessToken: token }).promise()
    .then(data => identity.formatUser(data));
  }
};

identity.getAdmin = function (region, token, callback) {
  identity.getUser(region, token, (err, data) => {
    if (err) {
      return callback(err);
    }
    if (!data.isAdmin) {
      return callback(error.forbidden());
    }
    return callback(null, data);
  });
};
