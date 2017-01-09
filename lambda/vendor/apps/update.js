'use strict';

import App from '../../../lib/app';

require('babel-polyfill');
const _ = require('lodash');
const request = require('../../../lib/request');
const db = require('../../../lib/db');
const error = require('../../../lib/error');
const identity = require('../../../lib/identity');
const joi = require('joi');
const validation = require('../../../lib/validation');

const commonValidationBody = {
  name: joi.string().max(128)
    .error(Error('Parameter name is required and may have 128 characters at ' +
    'most')),
  type: joi.string().valid('extractor', 'application', 'writer', 'other',
  'transformation', 'processor')
    .error(Error('Parameter type is required and must be one of: extractor, ' +
    'application, writer, other, transformation, processor')),
  repository: joi.object().keys({
    type: joi.string().valid('dockerhub', 'quay')
      .error(Error('Parameter repository.type must be one of: dockerhub, quay')),
    uri: joi.string().max(128)
      .error(Error('Parameter repository.uri must be uri and may have 128 ' +
      'characters at most')),
    tag: joi.string().max(20)
      .error(Error('Parameter repository.tag must be string and may have ' +
      '20 characters at most')),
    options: joi.object()
      .error(Error('Parameter repository.options must be object')),
  }),
  shortDescription: joi.string()
    .error(Error('Parameter shortDescription must be string')),
  longDescription: joi.string()
    .error(Error('Parameter longDescription must be string')),
  licenseUrl: joi.string().max(255).uri()
    .error(Error('Parameter licenseUrl must be url and may have 255 ' +
    'characters at most')),
  documentationUrl: joi.string().max(255).uri()
    .error(Error('Parameter documentationUrl must be url and may have 255 ' +
    'characters at most')),
  encryption: joi.boolean()
    .error(Error('Parameter encryption must be boolean')),
  defaultBucket: joi.boolean()
    .error(Error('Parameter defaultBucket must be boolean')),
  defaultBucketStage: joi.string().valid('in', 'out')
    .error(Error('Parameter defaultBucketStage must be one of: in, out')),
  uiOptions: joi.array().error(Error('Parameter uiOptions must be array')),
  imageParameters: joi.object(),
  testConfiguration: joi.object(),
  configurationSchema: joi.object(),
  configurationDescription: joi.string(),
  configurationFormat: joi.string().valid('json')
    .error(Error('Parameter configurationFormat can have only value "json"')),
  emptyConfiguration: joi.object(),
  actions: joi.array().error(Error('Parameter actions must be array')),
  fees: joi.boolean().error(Error('Parameter fees must be boolean')),
  limits: joi.string().error(Error('Parameter limits must be string')),
  logger: joi.string().valid('standard', 'gelf')
    .error(Error('Parameter logger must be one of: standard, gelf')),
  loggerConfiguration: joi.object(),
  stagingStorageInput: joi.string().valid('local', 's3')
    .error(Error('Parameter stagingStorageInput must be one of: local, s3')),
  isPublic: joi.boolean().error(Error('Parameter isPublic must be boolean')),
  vendor: joi.any().forbidden()
    .error(Error('Setting of parameter vendor is forbidden')),
  isApproved: joi.any().forbidden()
    .error(Error('Setting of parameter isApproved is forbidden')),
  createdOn: joi.any().forbidden()
    .error(Error('Setting of parameter createdOn is forbidden')),
  createdBy: joi.any().forbidden()
    .error(Error('Setting of parameter createdBy is forbidden')),
  version: joi.any().forbidden()
    .error(Error('Setting of parameter version is forbidden')),
  forwardToken: joi.any().forbidden()
    .error(Error('Setting of parameter forwardToken is forbidden')),
  forwardTokenDetails: joi.any().forbidden()
    .error(Error('Setting of parameter forwardTokenDetails is forbidden')),
  injectEnvironment: joi.any().forbidden()
    .error(Error('Setting of parameter injectEnvironment is forbidden')),
  cpuShares: joi.any().forbidden()
    .error(Error('Setting of parameter cpuShares is forbidden')),
  requiredMemory: joi.any().forbidden()
    .error(Error('Setting of parameter requiredMemory is forbidden')),
  processTimeout: joi.any().forbidden()
    .error(Error('Setting of parameter processTimeout is forbidden')),
  icon32: joi.any().forbidden()
    .error(Error('Setting of parameter icon32 is forbidden')),
  icon64: joi.any().forbidden()
    .error(Error('Setting of parameter icon64 is forbidden')),
  legacyUri: joi.any().forbidden()
    .error(Error('Setting of parameter legacyUri is forbidden')),
  permissions: joi.array().items(joi.object().keys({
    stack: joi.string().required(),
    projects: joi.array(),
  })).error(Error('Parameter permissions must be array')),
};

const createValidationBody = _.clone(commonValidationBody);
createValidationBody.id = joi.string().min(3).max(20)
  .regex(/^[a-zA-Z0-9-_]+$/)
  .required()
  .error(Error('Parameter id is required, must have between 3 and 20 ' +
  'characters and contain only letters, numbers, dashes and underscores'));
createValidationBody.name.required();
createValidationBody.type.required();

const app = new App(db, process.env, error);

module.exports.appsCreate = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    body: createValidationBody,
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
    .then(user => app.insertApp(JSON.parse(event.body), user)),
    db,
    event,
    context,
    callback,
    201
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));


const updateValidationBody = _.clone(commonValidationBody);
updateValidationBody.id = joi.any().forbidden()
  .error(Error('Setting of parameter id is forbidden'));

module.exports.appsUpdate = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
    },
    body: updateValidationBody,
  });

  return request.responseDbPromise(
    db.connect(process.env)
    .then(() => identity.getUser(process.env.REGION, event.headers.Authorization))
    .then(user => app.updateApp(
      event.pathParameters.appId,
      JSON.parse(event.body),
      user
    )),
    db,
    event,
    context,
    callback,
    204
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
