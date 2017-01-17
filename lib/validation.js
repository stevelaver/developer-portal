'use strict';

const _ = require('lodash');

class Validation {
  constructor(joi, error) {
    this.joi = joi;
    this.error = error;
  }

  validate(eventIn, schema) {
    const event = _.clone(eventIn);
    if (_.has(event, 'body') && _.isString(event.body)) {
      event.body = JSON.parse(event.body);
    }
    if (_.has(schema, 'body') && (!_.has(event, 'body') || event.body === null)) {
      throw this.error.unprocessable('Request body is missing');
    }
    const res = this.joi.validate(
      event,
      this.schema(schema),
      { allowUnknown: true }
    );

    if (res.error) {
      throw this.error.unprocessable(res.error.message);
    }
    return true;
  }

  schema(def) {
    let body = {};
    const headers = {};
    let path = {};
    let query = {};

    if (_.has(def, 'auth')) {
      headers.Authorization = this.joi.string().required()
        .error(Error('Header Authorization is required'));
    }

    if (_.has(def, 'query')) {
      query = _.merge(query, def.query);
    }

    if (_.has(def, 'body')) {
      body = _.merge(body, def.body);
    }

    if (_.has(def, 'pagination')) {
      query.offset = this.joi.number().integer().default(0).min(0)
        .allow('')
        .error(Error('Parameter offset must be integer greater then 0'));
      query.limit = this.joi.number().integer().default(1000)
        .min(1)
        .max(1000)
        .allow('')
        .error(Error('Parameter limit must be integer from 1 to 1000'));
    }

    if (_.has(def, 'path')) {
      path = _.merge(path, def.path);
    }

    const res = {};
    if (_.size(body)) {
      res.body = this.joi.object().allow(null).keys(body);
    }
    if (_.size(headers)) {
      res.headers = this.joi.object().allow(null).keys(headers);
    }
    if (_.size(path)) {
      res.pathParameters = this.joi.object().allow(null).keys(path);
    }
    if (_.size(query)) {
      res.queryStringParameters = this.joi.object().allow(null).keys(query);
    }

    return res;
  }

  createAppSchema() {
    const schema = this.commonAppSchema();
    schema.id = this.joi.string().min(3).max(30)
      .regex(/^[a-zA-Z0-9-_]+$/)
      .required()
      .error(Error('Parameter id is required, it must have between 3 and 30 ' +
        'characters and contain only letters, numbers, dashes and underscores'));
    schema.name.required();
    schema.type.required();
    return schema;
  }

  updateAppSchema() {
    const schema = this.commonAppSchema();
    schema.id = this.joi.any().forbidden()
      .error(Error('Setting of parameter id is forbidden'));
    return schema;
  }

  adminCreateAppSchema() {
    const schema = this.adminAppSchema();
    schema.id = this.joi.string().min(3).max(30)
      .regex(/^[a-zA-Z0-9-_]+$/)
      .required()
      .error(Error('Parameter id is required, it must have between 3 and 30 ' +
        'characters and contain only letters, numbers, dashes and underscores'));
    schema.name.required();
    schema.type.required();
    schema.vendor = this.joi.string().required()
      .error(Error('Setting of parameter vendor must be string'));
    return schema;
  }

  adminAppSchema() {
    const schema = this.commonAppSchema();
    schema.vendor = this.joi.string().optional()
      .error(Error('Setting of parameter vendor must be string'));
    schema.isApproved = this.joi.boolean().optional()
      .error(Error('Parameter isApproved must be boolean'));
    schema.forwardToken = this.joi.boolean().optional()
      .error(Error('Parameter forwardToken must be boolean'));
    schema.forwardTokenDetails = this.joi.boolean().optional()
      .error(Error('Parameter must be boolean'));
    schema.injectEnvironment = this.joi.boolean().optional()
      .error(Error('Parameter injectEnvironment must be boolean'));
    schema.cpuShares = this.joi.number().integer().optional()
      .error(Error('Parameter cpuShares must be integer'));
    schema.requiredMemory = this.joi.string().optional()
      .error(Error('Parameter requiredMemory must be string'));
    schema.processTimeout = this.joi.number().integer().optional()
      .error(Error('Parameter processTimeout muset be integer'));
    schema.legacyUri = this.joi.string().optional()
      .error(Error('Parameter legacyUri must be string'));
    schema.configurationFormat = this.joi.string().valid('json', 'yaml')
      .error(Error('Parameter configurationFormat can have value "json" or "yaml"'));
    return schema;
  }

  commonAppSchema() {
    return {
      name: this.joi.string().max(128)
        .error(Error('Parameter name is required and may have 128 characters at ' +
          'most')),
      type: this.joi.string().valid('extractor', 'application', 'writer', 'other',
        'transformation', 'processor')
        .error(Error('Parameter type is required and must be one of: extractor, ' +
          'application, writer, other, transformation, processor')),
      repository: this.joi.object().keys({
        type: this.joi.string().valid('dockerhub', 'quay')
          .error(Error('Parameter repository.type must be one of: dockerhub, quay')),
        uri: this.joi.string().max(128)
          .error(Error('Parameter repository.uri must be uri and may have 128 ' +
            'characters at most')),
        tag: this.joi.string().max(20)
          .error(Error('Parameter repository.tag must be string and may have ' +
            '20 characters at most')),
        options: this.joi.object()
          .error(Error('Parameter repository.options must be object')),
      }),
      shortDescription: this.joi.string()
        .error(Error('Parameter shortDescription must be string')),
      longDescription: this.joi.string()
        .error(Error('Parameter longDescription must be string')),
      licenseUrl: this.joi.string().max(255).uri()
        .error(Error('Parameter licenseUrl must be url and may have 255 ' +
          'characters at most')),
      documentationUrl: this.joi.string().max(255).uri()
        .error(Error('Parameter documentationUrl must be url and may have 255 ' +
          'characters at most')),
      encryption: this.joi.boolean()
        .error(Error('Parameter encryption must be boolean')),
      defaultBucket: this.joi.boolean()
        .error(Error('Parameter defaultBucket must be boolean')),
      defaultBucketStage: this.joi.string().valid('in', 'out')
        .error(Error('Parameter defaultBucketStage must be one of: in, out')),
      uiOptions: this.joi.array().error(Error('Parameter uiOptions must be array')),
      imageParameters: this.joi.object()
        .error(Error('Parameter imageParameters must be object')),
      testConfiguration: this.joi.object()
        .error(Error('Parameter testConfiguration must be object')),
      configurationSchema: this.joi.object()
        .error(Error('Parameter configurationSchema must be object')),
      configurationDescription: this.joi.string()
        .error(Error('Parameter configurationDescription must be string')),
      configurationFormat: this.joi.string().valid('json')
        .error(Error('Parameter configurationFormat can have only value "json"')),
      emptyConfiguration: this.joi.object()
        .error(Error('Parameter emptyConfiguration must be object')),
      actions: this.joi.array().error(Error('Parameter actions must be array')),
      fees: this.joi.boolean().error(Error('Parameter fees must be boolean')),
      limits: this.joi.string().error(Error('Parameter limits must be string')),
      logger: this.joi.string().valid('standard', 'gelf')
        .error(Error('Parameter logger must be one of: standard, gelf')),
      loggerConfiguration: this.joi.object()
        .error(Error('Parameter loggerConfiguration must be object')),
      stagingStorageInput: this.joi.string().valid('local', 's3')
        .error(Error('Parameter stagingStorageInput must be one of: local, s3')),
      isPublic: this.joi.boolean().error(Error('Parameter isPublic must be boolean')),
      vendor: this.joi.any().forbidden()
        .error(Error('Setting of parameter vendor is forbidden')),
      isApproved: this.joi.any().forbidden()
        .error(Error('Setting of parameter isApproved is forbidden')),
      createdOn: this.joi.any().forbidden()
        .error(Error('Setting of parameter createdOn is forbidden')),
      createdBy: this.joi.any().forbidden()
        .error(Error('Setting of parameter createdBy is forbidden')),
      version: this.joi.any().forbidden()
        .error(Error('Setting of parameter version is forbidden')),
      forwardToken: this.joi.any().forbidden()
        .error(Error('Setting of parameter forwardToken is forbidden')),
      forwardTokenDetails: this.joi.any().forbidden()
        .error(Error('Setting of parameter forwardTokenDetails is forbidden')),
      injectEnvironment: this.joi.any().forbidden()
        .error(Error('Setting of parameter injectEnvironment is forbidden')),
      cpuShares: this.joi.any().forbidden()
        .error(Error('Setting of parameter cpuShares is forbidden')),
      requiredMemory: this.joi.any().forbidden()
        .error(Error('Setting of parameter requiredMemory is forbidden')),
      processTimeout: this.joi.any().forbidden()
        .error(Error('Setting of parameter processTimeout is forbidden')),
      icon32: this.joi.any().forbidden()
        .error(Error('Setting of parameter icon32 is forbidden')),
      icon64: this.joi.any().forbidden()
        .error(Error('Setting of parameter icon64 is forbidden')),
      legacyUri: this.joi.any().forbidden()
        .error(Error('Setting of parameter legacyUri is forbidden')),
      permissions: this.joi.array().items(this.joi.object().keys({
        stack: this.joi.string().required().error(Error('A permission has required string parameter stack')),
        projects: this.joi.array().error(Error('A permission has optional parameter projects which has to be array')),
      })).error(Error('Parameter permissions must be array')),
    };
  }

}

export default Validation;
