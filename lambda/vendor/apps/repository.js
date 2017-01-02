'use strict';

import Repository from '../../../lib/repository';

require('babel-polyfill');
const aws = require('aws-sdk');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const identity = require('../../../lib/identity');
const joi = require('joi');
const request = require('../../../lib/request');
const validation = require('../../../lib/validation');

aws.config.setPromisesDependency(Promise);
const ecr = new aws.ECR({ region: process.env.REGION });
const iam = new aws.IAM({ region: process.env.REGION });
const repository = new Repository(db, ecr, iam, aws, process.env, error);

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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
      .then(user => repository.create(
        user.vendor,
        event.pathParameters.appId,
        user.email,
      )),
    db,
    event,
    context,
    callback,
    204
  );
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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
      .then(user => repository.get(
        new aws.STS({ region: process.env.REGION }),
        user.vendor,
        event.pathParameters.appId,
      )),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
