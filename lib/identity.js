'use strict';

const aws = require('aws-sdk');
const error = require('./error');
const Promise = require('bluebird');

const identity = module.exports;

identity.formatUser = (user) => {
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

identity.getUser = (region, token) => {
  aws.config.setPromisesDependency(Promise);
  const provider = new aws.CognitoIdentityServiceProvider({ region });
  return provider.getUser({ AccessToken: token }).promise()
  .then(data => identity.formatUser(data));
};

identity.getAdmin = (region, token) =>
  identity.getUser(region, token)
  .then(data => new Promise((resolve, reject) => {
    if (!data.isAdmin) {
      reject(error.forbidden());
    } else {
      resolve(data);
    }
  }));
