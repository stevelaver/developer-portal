'use strict';

import App from '../../../lib/app';
import Validation from '../../../lib/validation';

require('babel-polyfill');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const identity = require('../../../lib/identity');
const joi = require('joi');
const notification = require('../../../lib/notification');
const request = require('../../../lib/request');

const app = new App(db, process.env, error);
const validation = new Validation(joi, error);
notification.setHook(process.env.SLACK_HOOK_URL, process.env.SERVICE_NAME);

/**
 * Approve
 */
module.exports.handler = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
    .then(user => app.requestApproval(event.pathParameters.appId, user.vendor))
    .then(() => notification.approveApp(event.pathParameters.appId)),
    db,
    event,
    context,
    callback,
    202
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
