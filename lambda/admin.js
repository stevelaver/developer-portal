'use strict';

import App from '../app/app';
import Services from '../lib/Services';
import Vendor from '../app/vendor';
import DbUsers from '../lib/db/Users';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');

const db = require('../lib/db');
const request = require('../lib/request');

const services = new Services(process.env);
const identity = Services.getIdentity();
const app = new App(Services, db, process.env);
const validation = Services.getValidation();
const vendorApp = new Vendor(services, db, process.env, Services.getError());


function listUsers(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    query: ['filter'],
  });

  const filter = _.get(event, 'queryStringParameters.filter', '');
  const paginationToken = _.get(event, 'queryStringParameters.paginationToken', null);
  const headers = {};
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => services.getUserPool().listUsers(filter, paginationToken))
      .then((res) => {
        if (res.paginationToken) {
          headers.Link = `<${process.env.API_ENDPOINT}/admin/users?filter=${filter}&paginationToken=${res.paginationToken}>; rel=next`;
        }
        return res.users;
      }),
    db,
    event,
    context,
    callback,
    200,
    headers
  );
}

function deleteUser(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['email'],
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => new DbUsers(db.getConnection(), Services.getError()))
      .then(dbUsers => services.getUserPoolWithDatabase(dbUsers))
      .then(userPool => userPool.deleteUser(event.pathParameters.email))
      .then(() => null),
    db,
    event,
    context,
    callback,
    204
  );
}

function makeUserAdmin(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['email'],
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => services.getUserPool().makeUserAdmin(event.pathParameters.email))
      .then(() => null),
    db,
    event,
    context,
    callback,
    204
  );
}

function addUserToVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['email', 'vendor'],
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => new DbUsers(db.getConnection(), Services.getError()))
      .then(dbUsers => services.getUserPoolWithDatabase(dbUsers))
      .then(userPool => userPool.addUserToVendor(event.pathParameters.email, event.pathParameters.vendor)),
    db,
    event,
    context,
    callback,
    204
  );
}

function removeUserFromVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['email', 'vendor'],
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => services.getUserPool()
        .removeUserFromVendor(event.pathParameters.email, event.pathParameters.vendor))
      .then(() => services.getEmail().send(
        event.pathParameters.email,
        'Removal from vendor',
        'Keboola Developer Portal',
        `Your account was removed from vendor ${event.pathParameters.vendor} by an administrator.`,
      )),
    db,
    event,
    context,
    callback,
    204
  );
}

function approveApp(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['id'],
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(user => app.adminPublishApp(event.pathParameters.id, user))
      .then(vendor => services.getEmail().send(
        vendor.email,
        'App approval in Keboola Developer Portal',
        'Keboola Developer Portal',
        `Your app <strong>${event.pathParameters.id}</strong> has been approved.`,
      )),
    db,
    event,
    context,
    callback,
    204
  );
}

function listApps(event, context, callback) {
  validation.validate(event, {
    auth: true,
    pagination: true,
    query: ['filter'],
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.adminListApps(
        _.get(event, 'queryStringParameters.offset', null),
        _.get(event, 'queryStringParameters.limit', null)
      )),
    db,
    event,
    context,
    callback
  );
}

function detailApp(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: {
      id: Services.getJoi().string().required(),
      version: Services.getJoi().number().integer(),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.adminGetAppWithVendor(
        event.pathParameters.id,
        _.get(event, 'pathParameters.version', null)
      )),
    db,
    event,
    context,
    callback
  );
}

function updateApp(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['id'],
    body: validation.adminAppSchema(),
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(user => app.adminUpdateApp(
        event.pathParameters.id,
        JSON.parse(event.body),
        user
      )),
    db,
    event,
    context,
    callback
  );
}

function listAppChanges(event, context, callback) {
  validation.validate(event, {
    auth: true,
    query: {
      since: Services.getJoi().date().format('YYYY-MM-DD')
        .error(Error('Parameter since must be a date in format YYYY-MM-DD')),
      until: Services.getJoi().date().format('YYYY-MM-DD')
        .error(Error('Parameter until must be a date format YYYY-MM-DD')),
    },
  });

  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => identity.getAdmin(event.headers.Authorization))
      .then(() => app.adminListChangesAcrossApps(
        _.get(event, 'queryStringParameters.since', null),
        _.get(event, 'queryStringParameters.until', null)
      )),
    db,
    event,
    context,
    callback
  );
}

function createVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    body: validation.adminCreateVendorSchema(),
  });

  return request.responseDbPromise(
    identity.getAdmin(event.headers.Authorization)
      .then(() => vendorApp.create(JSON.parse(event.body))),
    db,
    event,
    context,
    callback,
    201
  );
}

function approveVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    body: {
      newId: validation.validateStringMaxLength('id', 32),
    },
    path: ['vendor'],
  });

  const body = JSON.parse(event.body);
  return request.responseDbPromise(
    identity.getAdmin(event.headers.Authorization)
      .then(() => vendorApp.approve(event.pathParameters.vendor, _.get(body, 'newId', null)))
      .then((vendor) => {
        if (vendor.createdBy) {
          const emailPromise = services.getEmail().send(
            vendor.createdBy,
            'Vendor approval in Keboola Developer Portal',
            'Keboola Developer Portal',
            `Your vendor has been approved with id <strong>${_.get(body, 'newId', null)}</strong>.`,
          );
          if (_.has(body, 'newId')) {
            return new Promise(res => res(new DbUsers(db.getConnection(), Services.getError())))
              .then(dbUsers => services.getUserPoolWithDatabase(dbUsers))
              .then(userPool => userPool.addUserToVendor(vendor.createdBy, body.newId)
                .then(() => userPool.removeUserFromVendor(vendor.createdBy, event.pathParameters.vendor))
                .then(() => emailPromise));
          }
          return emailPromise;
        }
      })
      .then(() => null),
    db,
    event,
    context,
    callback,
    204
  );
}


module.exports.admin = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/admin/users':
      return listUsers(event, context, callback);
    case '/admin/users/{email}':
      return deleteUser(event, context, callback);
    case '/admin/users/{email}/admin':
      return makeUserAdmin(event, context, callback);
    case '/admin/users/{email}/vendors/{vendor}':
      if (event.httpMethod === 'DELETE') {
        return removeUserFromVendor(event, context, callback);
      }
      return addUserToVendor(event, context, callback);
    case '/admin/apps':
      return listApps(event, context, callback);
    case '/admin/apps/{id}/approve':
      return approveApp(event, context, callback);
    case '/admin/apps/{id}':
      if (event.httpMethod === 'GET') {
        return detailApp(event, context, callback);
      }
      return updateApp(event, context, callback);
    case '/admin/changes':
      return listAppChanges(event, context, callback);
    case '/admin/vendors':
      return createVendor(event, context, callback);
    case '/admin/vendors/{vendor}/approve':
      return approveVendor(event, context, callback);
    default:
      throw Services.getError().notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));
