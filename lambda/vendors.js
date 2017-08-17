'use strict';

import Services from '../lib/Services';
import Vendor from '../app/vendor';

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
      .then(vendor => services.getUserPoolWithDatabase(db)
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
        return vendorApp.adminJoinVendor(user, event.pathParameters.vendor);
      }
      return vendorApp.addUserRequestToVendor(user.email, event.pathParameters.vendor)
        .then(vendor => services.getEmail().send(
          vendor.email,
          'Request to join your vendor in Keboola Developer Portal',
          'Keboola Developer Portal',
          `User ${user.name} <${user.email}> wants to become a member of your vendor ${vendor.id}. You can approve or ignore.`,
        ));
    },
    event,
    context,
    callback,
    204
  );
}

function acceptRequestJoinVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['vendor', 'username'],
  });

  return request.userAuthPromise(
    user => vendorApp.acceptRequestJoinVendor(event.pathParameters.username, event.pathParameters.vendor, user)
      .then(() => services.getEmail().send(
        event.pathParameters.username,
        'Request to join vendor in Keboola Developer Portal',
        'Keboola Developer Portal',
        `Your request to join vendor ${event.pathParameters.vendor} was accepted.`,
      )),
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
    path: ['vendor', 'username'],
  });

  return request.userAuthPromise(
    user => vendorApp.removeUser(
      event.pathParameters.vendor,
      event.pathParameters.username,
      user,
    ),
    event,
    context,
    callback,
    204
  );
}

function createServiceUser(event, context, callback) {
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
    user => vendorApp.createServiceUser(
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

function listUserRequests(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    path: ['vendor'],
  });

  const vendor = event.pathParameters.vendor;
  const headers = {};
  return request.userAuthPromise(
    user => vendorApp.listUserRequests(
      vendor,
      user,
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
    case '/vendors/{vendor}/user-requests':
      return listUserRequests(event, context, callback);
    case '/vendors/{vendor}/users/{username}':
      if (event.httpMethod === 'POST') {
        return acceptRequestJoinVendor(event, context, callback);
      }
      return removeUser(event, context, callback);
    case '/vendors/{vendor}/credentials':
      return createServiceUser(event, context, callback);
    default:
      throw Services.getError().notFound();
  }
}, event, context, callback);

