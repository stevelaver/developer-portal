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
      try {
        event.body = JSON.parse(event.body);
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw this.error.unprocessable('Request body does not contain valid json');
        }
        throw e;
      }
    }
    if (_.has(schema, 'body') && (!_.has(event, 'body') || event.body === null)) {
      event.body = {};
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
      headers.Authorization = this.joi.string().required().error(Error('Header Authorization is required'));
    }

    if (_.has(def, 'query')) {
      if (_.isArray(def.query)) {
        _.forEach(def.query, (item) => {
          switch (item) {
            case 'email':
              query.email = this.joi.string().email()
                .error(Error('Parameter email in query must be valid email address'));
              break;
            case 'version':
              query.version = this.joi.number().integer()
                .error(Error('Parameter version in query must be an integer'));
              break;
            default:
              query[item] = this.validateString(`${item} in query`);
          }
        });
      } else {
        query = _.merge(query, def.query);
      }
    }

    if (_.has(def, 'body')) {
      body = _.merge(body, def.body);
    }

    if (_.has(def, 'pagination')) {
      query.offset = this.joi.number().integer().default(0)
        .min(0)
        .allow('')
        .error(Error('Parameter offset must be integer greater then 0'));
      query.limit = this.joi.number().integer().default(1000)
        .min(1)
        .max(1000)
        .allow('')
        .error(Error('Parameter limit must be integer from 1 to 1000'));
    }

    if (_.has(def, 'path')) {
      if (_.isArray(def.path)) {
        _.forEach(def.path, (item) => {
          switch (item) {
            case 'email':
              path.email = this.joi.string().email().required()
                .error(Error('Parameter email in uri must be valid email address'));
              break;
            case 'version':
              path.version = this.joi.string().email().required()
                .error(Error('Parameter version in uri must be an integer'));
              break;
            default:
              path[item] = this.validateString(`${item} in uri`).required();
          }
        });
      } else {
        path = _.merge(path, def.path);
      }
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
    schema.id = this.joi.string().min(3).max(64)
      .regex(/^[a-zA-Z0-9-_]+$/)
      .required()
      .error(Error('Parameter id is required, it must have between 3 and 64 ' +
        'characters and contain only letters, numbers, dashes and underscores'));
    schema.name.required();
    schema.type.required();
    schema.isPublic.forbidden().error(Error('Setting of parameter isPublic is forbidden until the app is approved'));
    return schema;
  }

  updateAppSchema() {
    const schema = this.commonAppSchema();
    schema.id = this.validateForbidden('id');
    return schema;
  }

  updateApprovedAppSchema() {
    const schema = this.commonAppSchema();
    schema.id = this.validateForbidden('id');
    schema.isPublic = this.validateBoolean('isPublic');
    schema.forwardToken = this.validateForbidden('forwardToken');
    schema.forwardTokenDetails = this.validateForbidden('forwardTokenDetails');
    schema.injectEnvironment = this.validateForbidden('injectEnvironment');
    schema.cpuShares = this.validateForbidden('cpuShares');
    schema.requiredMemory = this.validateForbidden('requiredMemory');
    schema.processTimeout = this.validateForbidden('processTimeout');
    return schema;
  }

  adminAppSchema() {
    const schema = this.commonAppSchema();
    schema.vendor = this.validateStringMaxLength('vendor', 32);
    schema.isApproved = this.validateBoolean('isApproved');
    schema.isPublic = this.validateBoolean('isPublic');
    schema.legacyUri = this.validateStringMaxLength('legacyUri', 255);
    schema.configurationFormat = this.validateEnum('configurationFormat', ['json', 'yaml']);
    return schema;
  }

  commonAppSchema() {
    return {
      name: this.validateStringMaxLength('name', 128),
      type: this.validateEnum('type', ['extractor', 'application', 'writer']),
      repository: this.joi.object().optional().keys({
        type: this.validateEnum('repository.type', ['dockerhub', 'quay', 'builder', 'ecr']),
        uri: this.validateStringUri('repository.uri'),
        tag: this.validateStringMaxLength('tag', 20),
        options: this.validateObject('repository.options'),
      }).error(Error('Parameter repository must be object with optional valid keys type, uri, tag and options')),
      shortDescription: this.validateString('shortDescription'),
      longDescription: this.validateString('longDescription'),
      licenseUrl: this.validateStringUri('licenseUrl'),
      documentationUrl: this.validateStringUri('documentationUrl'),
      encryption: this.validateBoolean('encryption'),
      network: this.validateEnum('network', ['none', 'bridge']),
      defaultBucket: this.validateBoolean('defaultBucket'),
      defaultBucketStage: this.validateEnum('defaultBucketStage', ['in', 'out']),
      uiOptions: this.validateArray('uiOptions'),
      imageParameters: this.validateObject('imageParameters'),
      testConfiguration: this.validateObject('testConfiguration'),
      configurationSchema: this.validateObject('configurationSchema'),
      configurationDescription: this.validateString('configurationDescription'),
      configurationFormat: this.validateEnum('configurationFormat', ['json']),
      emptyConfiguration: this.validateObject('emptyConfiguration'),
      actions: this.validateArray('actions'),
      fees: this.validateBoolean('fees'),
      limits: this.validateString('limits'),
      logger: this.validateEnum('logger', ['standard', 'gelf']),
      loggerConfiguration: this.validateObject('loggerConfiguration'),
      stagingStorageInput: this.validateEnum('stagingStorageInput', ['local', 's3']),
      forwardToken: this.validateBoolean('forwardToken'),
      forwardTokenDetails: this.validateBoolean('forwardTokenDetails'),
      injectEnvironment: this.validateBoolean('injectEnvironment'),
      cpuShares: this.validateInteger('cpuShares'),
      requiredMemory: this.validateStringMaxLength('requiredMemory', 10),
      processTimeout: this.validateInteger('processTimeout'),
      permissions: this.validateArray('permissions').items(this.validateObject('item of permissions array').keys({
        stack: this.joi.string().required().error(Error('A permission has required string parameter stack')),
        projects: this.joi.array().error(Error('A permission has optional parameter projects which has to be array')),
      })).error(Error('Parameter permissions must be array')),
      icon32: this.validateForbidden('icon32'),
      icon64: this.validateForbidden('icon64'),
      legacyUri: this.validateForbidden('legacyUri'),
      vendor: this.validateForbidden('vendor'),
      isApproved: this.validateForbidden('isApproved'),
      isPublic: this.validateForbidden('isPublic'),
      createdOn: this.validateForbidden('createdOn'),
      createdBy: this.validateForbidden('createdBy'),
      version: this.validateForbidden('version'),
    };
  }

  adminCreateVendorSchema() {
    return {
      id: this.validateStringMaxLength('id', 32).required(),
      name: this.validateStringMaxLength('name', 128).required(),
      address: this.validateStringMaxLength('address', 255).required(),
      email: this.joi.string().email().max(128).required()
        .error(Error('Parameter email is required and must be an enail address with 128 characters at most')),
    };
  }


  validateForbidden(param) {
    return this.joi.any().forbidden().error(Error(`Setting of parameter ${param} is forbidden`));
  }

  validateBoolean(param) {
    return this.joi.boolean().optional().error(Error(`Parameter ${param} must be boolean`));
  }

  validateString(param) {
    return this.joi.string().optional().error(Error(`Parameter ${param} must be string`));
  }

  validateStringMaxLength(param, length) {
    return this.joi.string().max(length).optional()
      .error(Error(`Parameter ${param} must be string with max length of ${length}`));
  }

  validateStringUri(param) {
    return this.joi.string().max(255).optional()
      .error(Error(`Parameter ${param} must be valid uri with max length of 255`));
  }

  validateInteger(param) {
    return this.joi.number().integer().optional().error(Error(`Parameter ${param} must be integer`));
  }

  validateObject(param) {
    return this.joi.object().optional().error(Error(`Parameter ${param} must be object`));
  }

  validateEnum(param, values) {
    return this.joi.string().valid(values).optional()
      .error(Error(`Parameter ${param} must be one of: ${values.join(', ')}`));
  }

  validateArray(param) {
    return this.joi.array().error(Error(`Parameter ${param} must be array`));
  }
}

export default Validation;
