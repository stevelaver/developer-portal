'use strict';

import App from '../app/app';
import Icon from '../app/icon';
import Repository from '../app/repository';
import Services from '../lib/services';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');
const joi = require('joi');

const db = require('../lib/db');
const request = require('../lib/request');

const services = new Services(process.env);
const app = new App(Services, db, process.env);
const validation = Services.getValidation();


function create(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
    },
    body: validation.createAppSchema(),
  });

  return request.userAuthPromise(
    user => app.createApp(JSON.parse(event.body), event.pathParameters.vendor, user),
    event,
    context,
    callback,
    201
  );
}

function update(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      app: joi.string().required(),
      vendor: joi.string().required(),
    },
  });

  return request.userAuthPromise(
    user => new Promise(res => res(validation.validate(event, {
      body: validation.updateAppSchema(),
    })))
      .then(() => app.updateApp(
        event.pathParameters.app,
        event.pathParameters.vendor,
        JSON.parse(event.body),
        user
      )),
    event,
    context,
    callback
  );
}

function list(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    path: {
      vendor: joi.string().required(),
    },
  });

  return request.userAuthPromise(
    user => app.listApps(
      event.pathParameters.vendor,
      user,
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null),
    ),
    event,
    context,
    callback
  );
}

function detail(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
      app: joi.string().required(),
      version: joi.number().integer(),
    },
  });

  return request.userAuthPromise(
    user => app.getAppForVendor(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
      _.get(event, 'pathParameters.version', null),
    ),
    event,
    context,
    callback
  );
}

function deleteApp(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
      app: joi.string().required(),
    },
  });

  return request.userAuthPromise(
    user => app.deleteApp(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
    ),
    event,
    context,
    callback
  );
}

function requestPublishing(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
      app: joi.string().required(),
    },
  });

  return request.userAuthPromise(
    user => app.requestPublishing(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
    )
      .then(() => services.getNotification().publishApp(event.pathParameters.app)),
    event,
    context,
    callback,
    204
  );
}

function versions(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    path: {
      app: joi.string().required(),
      vendor: joi.string().required(),
    },
  });

  return request.userAuthPromise(
    user => app.listAppVersions(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null)
    ),
    event,
    context,
    callback
  );
}

function rollback(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      app: joi.string().required(),
      vendor: joi.string().required(),
      version: joi.number(),
    },
  });

  return request.userAuthPromise(
    user => app.rollbackAppVersion(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
      event.pathParameters.version
    ),
    event,
    context,
    callback,
    201
  );
}

function icon(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
      app: joi.string().required(),
    },
  });

  const iconApp = new Icon(Services, db, process.env);
  return request.userAuthPromise(
    user => iconApp.getUploadLink(
      user,
      event.pathParameters.vendor,
      event.pathParameters.app,
    ),
    event,
    context,
    callback
  );
}

function getRepository(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
      app: joi.string().required(),
    },
  });

  const repository = new Repository(Services, db, process.env);
  return request.userAuthPromise(
    user => repository.getCredentials(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
    ),
    event,
    context,
    callback
  );
}

function deprecateApp(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      vendor: joi.string().required(),
      app: joi.string().required(),
    },
    body: {
      expiredOn: joi.date().iso().error(Error('Parameter expiredOn must be a valid date in format YYYY-mm-dd')),
      replacementApp: validation.validateStringMaxLength('replacementApp', 128),
    },
  });

  const body = JSON.parse(event.body);
  return request.userAuthPromise(
    user => app.deprecate(
      event.pathParameters.app,
      event.pathParameters.vendor,
      user,
      _.get(body, 'expiredOn', null),
      _.get(body, 'replacementApp', null)
    ),
    event,
    context,
    callback,
    204
  );
}

module.exports.apps = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/vendors/{vendor}/apps':
      if (event.httpMethod === 'GET') {
        return list(event, context, callback);
      }
      return create(event, context, callback);
    case '/vendors/{vendor}/apps/{app}':
      switch (event.httpMethod) {
        case 'GET':
          return detail(event, context, callback);
        case 'DELETE':
          return deleteApp(event, context, callback);
        default:
          return update(event, context, callback);
      }
    case '/vendors/{vendor}/apps/{app}/publish':
      return requestPublishing(event, context, callback);
    case '/vendors/{vendor}/apps/{app}/versions':
      return versions(event, context, callback);
    case '/vendors/{vendor}/apps/{app}/versions/{version}':
      return detail(event, context, callback);
    case '/vendors/{vendor}/apps/{app}/versions/{version}/rollback':
      return rollback(event, context, callback);
    case '/vendors/{vendor}/apps/{app}/icon':
      return icon(event, context, callback);
    case '/vendors/{vendor}/apps/{app}/repository':
      return getRepository(event, context, callback);
    case '/vendors/{vendor}/apps/{app}/deprecate':
      return deprecateApp(event, context, callback);
    default:
      throw Services.getError().notFound();
  }
}, event, context, callback);
