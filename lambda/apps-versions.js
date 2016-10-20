'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const request = require('../lib/request');
const vandium = require('vandium');

module.exports.list = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      pathParameters: vandium.types.object().keys({
        appId: vandium.types.string().required(),
      }),
      queryStringParameters: vandium.types.object().allow(null).keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
      }),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
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
      db.listVersions(
        event.pathParameters.appId,
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null),
        cb
      );
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, callback));


module.exports.rollback = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      Authorization: vandium.types.string().required()
        .error(Error('Authorization header is required')),
    }),
    pathParameters: {
      appId: vandium.types.string().required(),
      version: vandium.types.number(),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
    function (cb) {
      identity.getUser(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.checkAppAccess(
        event.pathParameters.appId,
        user.vendor,
        err => cb(err, user.email)
      );
    },
    function (user, cb) {
      db.getApp(
        event.pathParameters.appId,
        event.pathParameters.version,
        (err, res) => cb(err, res, user)
      );
    },
    function (appIn, user, cb) {
      const app = appIn;
      delete app.version;
      db.updateApp(app, event.pathParameters.appId, user.email, cb);
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, context, callback));
