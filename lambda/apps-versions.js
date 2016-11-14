'use strict';

require('babel-polyfill');
const _ = require('lodash');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const joi = require('joi');
const Promise = require('bluebird');
const request = require('../lib/request');
const validation = require('../lib/validation');

const dbCallback = (err, res, callback) => {
  if (db) {
    try {
      db.end();
    } catch (err2) {
      // Ignore
    }
  }
  callback(err, res);
};

module.exports.list = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    pagination: true,
    path: {
      appId: joi.string().required(),
    },
  });
  db.connect(env);
  identity.getUser(env.REGION, event.headers.Authorization)
  .then(user => db.checkAppAccess(event.pathParameters.appId, user.vendor))
  .then(() => db.listVersions(
    event.pathParameters.appId,
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null)
  ))
  .then((res) => {
    db.end();
    return request.response(null, res, event, context, callback);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));


module.exports.rollback = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
      version: joi.number(),
    },
  });
  db.connect(env);
  let user;
  identity.getUser(env.REGION, event.headers.Authorization)
  .then(u => new Promise((resolve) => {
    user = u;
    resolve();
  }))
  .then(() => db.checkAppAccess(event.pathParameters.appId, user.vendor))
  .then(() => db.getApp(event.pathParameters.appId))
  .then((appIn) => {
    const app = appIn;
    delete app.version;
    return db.updateApp(app, event.pathParameters.appId, user.email);
  })
  .then(() => {
    db.end();
    return request.response(null, null, event, context, callback, 204);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));
