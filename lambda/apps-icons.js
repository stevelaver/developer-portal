'use strict';

import App from '../lib/app';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const db = require('../lib/db');
const env = require('../env.yml');
const error = require('../lib/error');
const identity = require('../lib/identity');
const joi = require('joi');
const moment = require('moment');
const Promise = require('bluebird');
const request = require('../lib/request');
const validation = require('../lib/validation');

const app = new App(db, env, error);
aws.config.setPromisesDependency(Promise);
const s3 = new aws.S3();

module.exports.links = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    db.connect(env)
    .then(() => identity.getUser(env.REGION, event.headers.Authorization))
    .then(user => app.getIcons(s3, moment, event.pathParameters.appId, user.vendor)),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


module.exports.upload = (event, context, callback) => request.errorHandler(() => {
  if (!_.has(event, 'Records') || !event.Records.length ||
    !_.has(event.Records[0], 's3') || !_.has(event.Records[0].s3, 'bucket') ||
    !_.has(event.Records[0].s3, 'object') ||
    !_.has(event.Records[0].s3.bucket, 'name') ||
    !_.has(event.Records[0].s3.object, 'key')) {
    throw Error(`Event is missing. See: ${JSON.stringify(event)}`);
  }

  if (event.Records[0].eventName !== 'ObjectCreated:Put') {
    return callback();
  }

  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const appId = key.split('/').shift();
  const size = key.split('/')[1];

  return db.connect(env)
  .then(() => app.uploadIcon(s3, appId, size, `${bucket}/${key}`))
  .then(() => db.endCallback(null, null, callback))
  .catch(err => db.endCallback(err, null, callback));
}, event, context, (err, res) => db.endCallback(err, res, callback));
