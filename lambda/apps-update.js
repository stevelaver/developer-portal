'use strict';

require('babel-polyfill');
const async = require('async');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const request = require('../lib/request');
const vandium = require('vandium');

const commonValidationBody = {
  name: vandium.types.string().max(128)
    .error(Error('Parameter name is required and may have ' +
    '128 characters at most')),
  type: vandium.types.string().valid('extractor', 'application',
    'writer', 'other', 'transformation', 'processor')
    .error(Error('Parameter type is required and must be one of' +
    ': extractor, application, writer, other, transformation, processor')),
  repository: vandium.types.object().keys({
    type: vandium.types.string().valid('dockerhub', 'quay')
      .error(Error('Parameter repository.type must be one of: ' +
      'dockerhub, quay')),
    uri: vandium.types.string().max(128)
      .error(Error('Parameter repository.uri must be uri and ' +
      'may have 128 characters at most')),
    tag: vandium.types.string().max(20)
      .error(Error('Parameter repository.tag must be string ' +
      'and may have 20 characters at most')),
    options: vandium.types.object()
      .error(Error('Parameter repository.options must be object')),
  }),
  shortDescription: vandium.types.string()
    .error(Error('Parameter shortDescription must be string')),
  longDescription: vandium.types.string()
    .error(Error('Parameter longDescription must be string')),
  licenseUrl: vandium.types.string().max(255).uri()
    .error(Error('Parameter licenseUrl must be url and may ' +
    'have 255 characters at most')),
  documentationUrl: vandium.types.string().max(255).uri()
    .error(Error('Parameter documentationUrl must be url and ' +
    'may have 255 characters at most')),
  encryption: vandium.types.boolean()
    .error(Error('Parameter encryption must be boolean')),
  defaultBucket: vandium.types.boolean()
    .error(Error('Parameter defaultBucket must be boolean')),
  defaultBucketStage: vandium.types.string().valid('in', 'out')
    .error(Error('Parameter defaultBucketStage must be one ' +
    'of: in, out')),
  uiOptions: vandium.types.array()
    .error(Error('Parameter uiOptions must be array')),
  testConfiguration: vandium.types.object(),
  configurationSchema: vandium.types.object(),
  configurationDescription: vandium.types.string(),
  emptyConfiguration: vandium.types.object(),
  actions: vandium.types.array()
    .error(Error('Parameter actions must be array')),
  fees: vandium.types.boolean()
    .error(Error('Parameter fees must be boolean')),
  limits: vandium.types.string()
    .error(Error('Parameter limits must be string')),
  logger: vandium.types.string().valid('standard', 'gelf')
    .error(Error('Parameter logger must be one of: standard, gelf')),
  loggerConfiguration: vandium.types.object(),
  isVisible: vandium.types.boolean()
    .error(Error('Parameter isVisible must be boolean')),
  vendor: vandium.types.any().forbidden()
    .error(Error('Setting of parameter vendor is forbidden')),
  isApproved: vandium.types.any().forbidden()
    .error(Error('Setting of parameter isApproved is forbidden')),
  createdOn: vandium.types.any().forbidden()
    .error(Error('Setting of parameter createdOn is forbidden')),
  createdBy: vandium.types.any().forbidden()
    .error(Error('Setting of parameter createdBy is forbidden')),
  version: vandium.types.any().forbidden()
    .error(Error('Setting of parameter version is forbidden')),
  forwardToken: vandium.types.any().forbidden()
    .error(Error('Setting of parameter forwardToken is forbidden')),
  requiredMemory: vandium.types.any().forbidden()
    .error(Error('Setting of parameter requiredMemory is forbidden')),
  processTimeout: vandium.types.any().forbidden()
    .error(Error('Setting of parameter processTimeout is forbidden')),
  icon32: vandium.types.any().forbidden()
    .error(Error('Setting of parameter icon32 is forbidden')),
  icon64: vandium.types.any().forbidden()
    .error(Error('Setting of parameter icon64 is forbidden')),
  legacyUri: vandium.types.any().forbidden()
    .error(Error('Setting of parameter legacyUri is forbidden')),
};

const createValidationBody = commonValidationBody;
createValidationBody.id = vandium.types.string().min(3).max(50)
  .regex(/^[a-zA-Z0-9-_]+$/)
  .required()
  .error(Error('Parameter id is required, must have between ' +
  '3 and 50 characters and contain only letters, numbers, dashes ' +
  'and underscores'));
createValidationBody.name.required();
createValidationBody.type.required();

module.exports.appsCreate = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      body: vandium.types.object().keys(commonValidationBody),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  const params = event.body;

  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
    function (cb) {
      identity.getUser(env.REGION, event.headers.Authorization, (err, data) => {
        if (err) {
          return cb(err);
        }
        params.createdBy = data.email;
        return cb(null, data);
      });
    },
    function (user, cb) {
      params.vendor = user.vendor;
      params.id = `${user.vendor}.${params.id}`;

      db.checkAppNotExists(params.id, err => cb(err));
    },
    function (cb) {
      db.insertApp(params, err => cb(err));
    },
  ], (err) => {
    db.end();
    return request.response(err, null, event, context, callback, 204);
  });
}, context, callback));


const updateValidationBody = commonValidationBody;
updateValidationBody.id = vandium.types.any().forbidden()
  .error(Error('Setting of parameter id is forbidden'));

module.exports.appsUpdate = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required()
          .error(Error('Authorization header is required')),
      }),
      pathParameters: vandium.types.object().keys({
        appId: vandium.types.string().required(),
      }),
      body: vandium.types.object().keys(updateValidationBody),
    },
  },
}).handler((event, context, callback) => request.errorHandler(() => {
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
    function (cb) {
      identity.getUser(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.checkAppAccess(
        event.pathParameters.appId,
        user.vendor,
        err => cb(err, user)
      );
    },
    function (user, cb) {
      db.updateApp(event.body, event.pathParameters.appId, user.email, cb);
    },
  ], (err) => {
    db.end();
    return request.response(err, null, event, context, callback, 204);
  });
}, context, callback));
