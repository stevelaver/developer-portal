'use strict';

require('babel-polyfill');
const async = require('async');
const db = require('../lib/dbp');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const joi = require('joi');
const notification = require('../lib/notification');
const request = require('../lib/request');
const validation = require('../lib/validation');

/**
 * Approve
 */
module.exports.handler = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    auth: true,
    path: {
      appId: joi.string().required(),
    },
  }));
  db.connect(env);
  identity.getUser(env.REGION, event.headers.Authorization)
  .then(user => db.checkAppAccess(event.pathParameters.appId, user.vendor))
  .then(() => db.getApp(event.pathParameters.appId))
  .then((app) => {console.log(app);
    if (app.isApproved) {
      throw error.badRequest('Already approved');
    }
    if (!app.repository.type) {
      throw error.badRequest('App property repository.type cannot be empty');
    }
    if (!app.repository.uri) {
      throw error.badRequest('App property repository.uri cannot be empty');
    }
    if (!app.repository.tag) {
      throw error.badRequest('App property repository.tag cannot be empty');
    }
    if (!app.shortDescription) {
      throw error.badRequest('App property shortDescription cannot be empty');
    }
    if (!app.longDescription) {
      throw error.badRequest('App property longDescription cannot be empty');
    }
    if (!app.licenseUrl) {
      throw error.badRequest('App property licenseUrl cannot be empty');
    }
    if (!app.documentationUrl) {
      throw error.badRequest('App property documentationUrl cannot be empty');
    }
    if (!app.icon32) {
      throw error.badRequest('App icon of size 32px is missing, upload it first.');
    }
    if (!app.icon64) {
      throw error.badRequest('App icon of size 64px is missing, upload it first.');
    }

    notification.setHook(env.SLACK_HOOK_URL, env.SERVICE_NAME);
    return notification.approveApp(app);
  })
  .then(() => {
    db.end();
    return request.response(null, null, event, context, callback, 202);
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, callback);
