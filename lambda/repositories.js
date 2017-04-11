'use strict';

import Repository from '../app/repository';
import Services from '../lib/Services';

require('longjohn');
require('source-map-support').install();
const joi = require('joi');

const db = require('../lib/db');
const request = require('../lib/request');

const identity = Services.getIdentity();
const repository = new Repository(Services, db, process.env, Services.getError());
const validation = Services.getValidation();


function createRepository(event, context, callback) {
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
}


function getRepository(event, context, callback) {
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

module.exports.repositories = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/vendors/{vendor}/apps/{app}/repository':
      switch (event.httpMethod) {
        case 'POST':
          return createRepository(event, context, callback);
        case 'GET':
          return getRepository(event, context, callback);
        default:
          throw Services.getError().notFound();
      }
    default:
      throw Services.getError().notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
