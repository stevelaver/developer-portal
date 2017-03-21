'use strict';

import Identity from '../lib/identity';
import InitApp from '../lib/InitApp';
import Validation from '../lib/validation';
import Vendor from '../app/vendor';

require('longjohn');
require('babel-polyfill');
require('source-map-support').install();
const joi = require('joi');
const jwt = require('jsonwebtoken');

const db = require('../lib/db');
const error = require('../lib/error');
const request = require('../lib/request');

const init = new InitApp(process.env);
const identity = new Identity(jwt, error);
const validation = new Validation(joi, error);
const vendorApp = new Vendor(init, db, process.env, error);


function createVendor(event, context, callback) {
  validation.validate(event, {
    body: {
      name: joi.string().max(64).required()
        .error(Error('Parameter vendor.name is required string with max length 64 when vendor is object')),
      address: joi.string().required()
        .error(Error('Parameter vendor.address is required string when vendor is object')),
      email: joi.string().email().required()
        .error(Error('Parameter vendor.email is required email address when vendor is object')),
    },
  });
  const body = JSON.parse(event.body);

  const vendorId = `_v${Date.now()}${Math.random()}`.substr(0, 32);
  return request.responsePromise(
    identity.getUser(event.headers.Authorization)
      .then(user =>
        db.connect(this.env)
          .then(() => vendorApp.create({
            id: vendorId,
            name: body.name,
            address: body.address,
            email: body.email,
            createdBy: user.email,
          }, false))
          .then(() => init.getUserPool().addUserToVendor(user.email, vendorId))
          .then(() => init.getNotification().approveVendor(vendorId, body.vendor.name, {
            name: body.name,
            email: body.email,
          })),
      )
      .then(() => db.end())
      .catch((err) => {
        db.end();
        throw err;
      }),
    event,
    context,
    callback,
    204
  );
}

function requestJoinVendor(event, context, callback) {
  validation.validate(event, {
    auth: true,
    path: ['vendor'],
  });

  return request.responsePromise(
    identity.getUser(event.headers.Authorization)
      .then((user) => {
        if (user.isAdmin) {
          return vendorApp.join(user, event.pathParameters.vendor);
        }
        return init.getNotification().approveJoinVendor({
          email: user.email,
          vendor: event.pathParameters.vendor,
        });
      }),
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

  return request.responsePromise(
    identity.getUser(event.headers.Authorization)
      .then(user => vendorApp.invite(
        event.pathParameters.vendor,
        event.pathParameters.email,
        user,
      )),
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

  return vendorApp.acceptInvitation(
    event.pathParameters.vendor,
    event.pathParameters.email,
    event.pathParameters.code,
  )
    .then(() => request.htmlResponse(null, {
      header: 'Invitation confirmed',
      content: `Your invitation to vendor ${event.pathParameters.vendor} has been successfully confirmed.`,
    }, event, context, callback))
    .catch(err => request.htmlResponse(err, null, event, context, callback));
}


module.exports.vendors = (event, context, callback) => request.errorHandler(() => {
  switch (event.resource) {
    case '/vendors':
      return createVendor(event, context, callback);
    case '/vendors/{vendor}/users':
      return requestJoinVendor(event, context, callback);
    case '/vendors/{vendor}/invitations/{email}':
      return sendInvitation(event, context, callback);
    case '/vendors/{vendor}/invitations/{email}/{code}':
      return acceptInvitation(event, context, callback);
    default:
      throw error.notFound();
  }
}, event, context, (err, res) => db.endCallback(err, res, callback));

