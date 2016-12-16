'use strict';

import App from '../../../lib/app';

require('babel-polyfill');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const identity = require('../../../lib/identity');
const joi = require('joi');
const notification = require('../../../lib/notification');
const request = require('../../../lib/request');
const validation = require('../../../lib/validation');

const app = new App(db, process.env, error);
notification.setHook(process.env.SLACK_HOOK_URL, process.env.SERVICE_NAME);

/**
 * Create repository
 */
module.exports.create = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
    },
  });

  // TODO
}, event, context, (err, res) => db.endCallback(err, res, callback));

/**
 * Get repository
 */
module.exports.get = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
    },
  });

  // TODO
}, event, context, (err, res) => db.endCallback(err, res, callback));
