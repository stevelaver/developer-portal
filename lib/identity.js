'use strict';

const aws = require('aws-sdk');
const error = require('./error');

const identity = module.exports;

identity.getUser = function (region, token, callback) {
  const provider = new aws.CognitoIdentityServiceProvider({ region });
  provider.getUser({ AccessToken: token }, (err, data) => {
    if (err) {
      return callback(err);
    }

    const user = {};
    data.UserAttributes.map((obj) => {
      user[obj.Name] = obj.Value;
    });

    return callback(null, {
      id: user.sub,
      email: data.Username,
      name: user.name,
      vendor: user.profile,
      isAdmin: user['custom:isAdmin'] === '1',
    });
  });
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
