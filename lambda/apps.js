'use strict';

import App from '../app/app';
import Icon from '../app/icon';
import Repository from '../app/repository';
import Services from '../lib/Services';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');
const joi = require('joi');
const moment = require('moment');

const db = require('../lib/db');
const request = require('../lib/request');

const services = new Services(process.env);
const identity = Services.getIdentity();
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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.createApp(JSON.parse(event.body), event.pathParameters.vendor, user)),
    db,
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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => {
        validation.validate(event, {
          body: validation.updateAppSchema(),
        });
      })
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.updateApp(
        event.pathParameters.app,
        event.pathParameters.vendor,
        JSON.parse(event.body),
        user
      )),
    db,
    event,
    context,
    callback,
    204
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

  const cfUri = process.env.CLOUDFRONT_URI;
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.listApps(
        event.pathParameters.vendor,
        user,
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null),
      ))
      .then(res => res.map(r => App.formatIcons(r, cfUri))),
    db,
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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.getAppForVendor(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
        _.get(event, 'pathParameters.version', null),
      )),
    db,
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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.deleteApp(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
        moment,
      )),
    db,
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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.requestPublishing(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
      ))
      .then(() => services.getNotification().approveApp(event.pathParameters.app)),
    db,
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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.listAppVersions(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null)
      )),
    db,
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

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.rollbackAppVersion(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
        event.pathParameters.version
      )),
    db,
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
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => iconApp.getUploadLink(
        user,
        event.pathParameters.vendor,
        event.pathParameters.app,
      )),
    db,
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
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => repository.getCredentials(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
      )),
    db,
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
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getUser(event.headers.Authorization))
      .then(user => app.deprecate(
        event.pathParameters.app,
        event.pathParameters.vendor,
        user,
        _.get(body, 'expiredOn', null),
        _.get(body, 'replacementApp', null)
      )),
    db,
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
    case '/vendors/{vendor}/apps/{app}/approve':
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
}, event, context, (err, res) => db.endCallback(err, res, callback));
