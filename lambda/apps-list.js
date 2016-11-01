'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const joi = require('joi');
const request = require('../lib/request');
const validation = require('../lib/validation');

module.exports.appsList = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    auth: true,
    pagination: true,
  });
  db.connectEnv(env);
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      identity.getUser(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.listAppsForVendor(
        user.vendor,
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null),
        cb
      );
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, callback);

module.exports.appsDetail = (event, context, callback) => request.errorHandler(() => {
  const schema = validation.schema({
    auth: true,
    path: {
      appId: joi.string().required(),
      version: joi.number().integer(),
    },
  });
  db.connectEnv(env);
  async.waterfall([
    function (cb) {
      validation.validate(event, schema, cb);
    },
    function (cb) {
      identity.getUser(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.checkAppAccess(
        event.pathParameters.appId,
        user.vendor,
        err => cb(err)
      );
    },
    function (cb) {
      db.getApp(event.pathParameters.appId, event.pathParameters.version, cb);
    },
    function (appIn, cb) {
      const app = appIn;
      app.icon = {
        32: `https://${env.CLOUDFRONT_URI}/${app.icon32}`,
        64: `https://${env.CLOUDFRONT_URI}/${app.icon64}`,
      };
      delete app.icon32;
      delete app.icon64;
      cb(null, app);
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, callback);
