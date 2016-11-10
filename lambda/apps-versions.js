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

module.exports.list = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    auth: true,
    pagination: true,
    path: {
      appId: joi.string().required(),
    },
  }));
  db.connectEnv(env);
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
}, event, context, callback);


module.exports.rollback = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    auth: true,
    path: {
      appId: joi.string().required(),
      version: joi.number(),
    },
  }));
  db.connectEnv(env);
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
}, event, context, callback);
