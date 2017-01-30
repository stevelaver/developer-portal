'use strict';

import App from '../../../lib/app';
import Identity from '../../../lib/identity';
import Notification from '../../../lib/notification';
import Validation from '../../../lib/validation';

require('babel-polyfill');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const joi = require('joi');
const jwt = require('jsonwebtoken');
const request = require('../../../lib/request');
const requestLib = require('request-promise-lite');

const app = new App(db, Identity, process.env, error);
const identity = new Identity(jwt, error);
const notification = new Notification(
  requestLib,
  process.env.SLACK_HOOK_URL,
  process.env.SERVICE_NAME
);
const validation = new Validation(joi, error);

/**
 * Approve
 */
module.exports.handler = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
      app: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.requestApproval(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
      ))
      .then(() => notification.approveApp(event.pathParameters.app)),
    db,
    event,
    context,
    callback,
    202
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
