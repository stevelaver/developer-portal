'use strict';

require('babel-polyfill');
const _ = require('lodash');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const joi = require('joi');
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

module.exports.appsList = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    pagination: true,
  });
  db.connect(env);
  identity.getUser(env.REGION, event.headers.Authorization)
  .then(user => db.listAppsForVendor(
    user.vendor,
    _.get(event, 'queryStringParameters.offset', null),
    _.get(event, 'queryStringParameters.limit', null),
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

module.exports.appsDetail = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
      version: joi.number().integer(),
    },
  });
  db.connect(env);
  identity.getUser(env.REGION, event.headers.Authorization)
  .then(user => db.checkAppAccess(event.pathParameters.appId, user.vendor))
  .then(() => db.getApp(event.pathParameters.appId, event.pathParameters.version))
  .then((appIn) => {
    const app = appIn;
    app.icon = {
      32: `https://${env.CLOUDFRONT_URI}/${app.icon32}`,
      64: `https://${env.CLOUDFRONT_URI}/${app.icon64}`,
    };
    delete app.icon32;
    delete app.icon64;
    db.end();
    return request.response(null, app, event, context, callback);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));
