'use strict';

import Identity from '../lib/identity';
import Repository from '../lib/repository';
import Validation from '../lib/validation';

require('longjohn');
require('babel-polyfill');
const aws = require('aws-sdk');
const db = require('../lib/db');
const error = require('../lib/error');
const joi = require('joi');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const request = require('../lib/request');

aws.config.setPromisesDependency(Promise);
const ecr = new aws.ECR({ region: process.env.REGION });

const identity = new Identity(jwt, error);
const repository = new Repository(db, ecr, aws, Identity, process.env, error);
const validation = new Validation(joi, error);

/**
 * Create repository
 */
module.exports.create = (event, context, callback) => request.errorHandler(() => {
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
      .then(user => repository.create(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
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
      vendor: joi.string().required(),
      app: joi.string().required(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => repository.get(
        new aws.STS({ region: process.env.REGION }),
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
