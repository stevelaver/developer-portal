'use strict';

import App from '../../../lib/app';
import Identity from '../../../lib/identity';
import Validation from '../../../lib/validation';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const joi = require('joi');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const Promise = require('bluebird');
const request = require('../../../lib/request');

aws.config.setPromisesDependency(Promise);
const s3 = new aws.S3();

const app = new App(db, Identity, process.env, error);
const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);

module.exports.links = (event, context, callback) => request.errorHandler(() => {
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
    .then(user => app.getIcons(
      s3,
      moment,
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
    )),
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

  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const path = key.split('/');
  const appId = path[1];
  const size = path[2];

  if (event.Records[0].eventName !== 'ObjectCreated:Put' || path[0] !== 'icons') {
    return callback();
  }

  if (Number(size) !== 32 && Number(size) !== 64) {
    throw Error(`Icon size is invalid. File: ${key}`);
  }

  return db.connect(process.env)
  .then(() => app.uploadIcon(s3, appId, size, `${bucket}/${key}`))
  .then(() => db.endCallback(null, null, callback))
  .catch(err => db.endCallback(err, null, callback));
}, event, context, (err, res) => db.endCallback(err, res, callback));
