'use strict';

import Services from '../lib/Services';
import Vendor from '../app/vendor';
import DbUsers from '../lib/db/Users';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');
const joi = require('joi');
const generator = require('generate-password');

const db = require('../lib/db');
const request = require('../lib/request');

const services = new Services(process.env);
const validation = Services.getValidation();
const vendorApp = new Vendor(services, db, process.env, Services.getError());


function createVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    body: validation.createVendorSchema(),
  });
  const body = JSON.parse(event.body);

  return request.userAuthPromise(
    user => vendorApp.create({
      name: body.name,
      address: body.address,
      email: body.email,
      createdBy: user.email,
    }, false)
      .then(vendor => new Promise(res => res(new DbUsers(db.getConnection(), Services.getError())))
        .then(dbUsers => services.getUserPoolWithDatabase(dbUsers))
        .then(userPool => userPool.addUserToVendor(user.email, vendor.id))
        .then(() => services.getNotification().approveVendor(vendor.id, body.name, {
          name: body.name,
          email: body.email,
        }))
        .then(() => vendor)),
    event,
    context,
    callback,
    201
  );
}

function updateVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['vendor'],
    body: validation.updateVendorSchema(),
  });

  const body = JSON.parse(event.body);
  return request.userAuthPromise(
    user => vendorApp.updateVendor(
      event.pathParameters.vendor,
      body,
      user,
    ),
    event,
    context,
    callback
  );
}

function requestJoinVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['vendor'],
  });

  return request.userAuthPromise(
    (user) => {
      if (user.isAdmin) {
        return vendorApp.join(user, event.pathParameters.vendor);
      }
      return vendorApp.checkVendorExists(event.pathParameters.vendor)
        .then(() => services.getNotification().approveJoinVendor({
          name: user.name,
          email: user.email,
        }, event.pathParameters.vendor));
    },
    event,
    context,
    callback,
    204
  );
}

function sendInvitation(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['vendor', 'email'],
  });

  return request.userAuthPromise(
    user => vendorApp.invite(
      event.pathParameters.vendor,
      event.pathParameters.email,
      user,
    ),
    event,
    context,
    callback,
    204
  );
}

function acceptInvitation(event, context, callback) {
  validation.validate(event, {
    path: ['vendor', 'email', 'code'],
  });

  return db.connect(process.env)
    .then(() => vendorApp.acceptInvitation(
      event.pathParameters.vendor,
      event.pathParameters.email,
      event.pathParameters.code,
    ))
    .then(() => db.end())
    .then(() => request.htmlResponse(null, {
      header: 'Invitation confirmed',
      content: `Your invitation to vendor ${event.pathParameters.vendor} has been successfully confirmed.`,
    }, event, context, callback))
    .catch((err) => {
      db.end();
      return request.htmlResponse(err, null, event, context, callback);
    });
}

function removeUser(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['vendor', 'email'],
  });

  return request.userAuthPromise(
    user => vendorApp.removeUser(
      event.pathParameters.vendor,
      event.pathParameters.email,
      user,
    ),
    event,
    context,
    callback,
    204
  );
}

function createCredentials(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['vendor'],
    body: {
      name: joi.string().token().max(64).required()
        .error(Error('Parameter name is required and can only contain a-z, A-Z, 0-9, and underscore _ and has max length 64 chars')),
      description: joi.string().max(256).error(Error('Parameter description is required string with max length 256 chars')),
    },
  });
  const body = JSON.parse(event.body);

  return request.userAuthPromise(
    user => vendorApp.createCredentials(
      event.pathParameters.vendor,
      body.name,
      body.description,
      user,
      generator,
    ),
    event,
    context,
    callback
  );
}

function listUsers(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    path: ['vendor'],
  });

  const vendor = event.pathParameters.vendor;
  const headers = {};
  return request.userAuthPromise(
    user => vendorApp.listUsers(
      vendor,
      user,
      _.get(event, 'queryStringParameters.service', null),
      _.get(event, 'queryStringParameters.offset', null),
      _.get(event, 'queryStringParameters.limit', null),
    ),
    event,
    context,
    callback,
    200,
    headers
  );
}


module.exports.vendors = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/vendors':
      return createVendor(event, context, callback);
    case '/vendors/{vendor}':
      return updateVendor(event, context, callback);
    case '/vendors/{vendor}/users':
      if (event.httpMethod === 'GET') {
        return listUsers(event, context, callback);
      }
      return requestJoinVendor(event, context, callback);
    case '/vendors/{vendor}/invitations/{email}':
      return sendInvitation(event, context, callback);
    case '/vendors/{vendor}/invitations/{email}/{code}':
      return acceptInvitation(event, context, callback);
    case '/vendors/{vendor}/users/{email}':
      return removeUser(event, context, callback);
    case '/vendors/{vendor}/credentials':
      return createCredentials(event, context, callback);
    default:
      throw Services.getError().notFound();
  }
}, event, context, callback);

