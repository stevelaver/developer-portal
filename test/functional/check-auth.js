'use strict';

require('dotenv').config({ path: '.env-test', silent: true });
const async = require('async');
const env = require('../../lib/env').load();
const request = require('request');

const chai = require('chai');
const dirtyChai = require('dirty-chai');

const expect = chai.expect;
chai.use(dirtyChai);

const checkAuth = function (err, res, bodyIn, callback) {
  expect(err, JSON.stringify(err)).to.be.null();
  const body = JSON.parse(bodyIn);
  expect(body).to.have.property('message');
  expect(res).to.have.property('statusCode');
  expect(res.statusCode).to.equal(401);
  callback();
};

describe('Check if all endpoints have auth required', () => {
  it('Check Auth', (done) => {
    async.parallel([
      (cb) => {
        // Get profile
        request.get(
          { url: `${env.API_ENDPOINT}/auth/profile` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Join vendor
        request.post(
          { url: `${env.API_ENDPOINT}/auth/vendors/keboola` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
    ], done);
  });

  it('Check Apps', (done) => {
    async.parallel([
      (cb) => {
        // Create app
        request.post(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Get app detail
        request.get(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // List apps
        request.get(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Approve
        request.post(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/approve` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Update app
        request.patch(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Request url to upload icons
        request.post(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/icons` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Rollback version
        request.post(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/versions/1/rollback` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // List versions
        request.get(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/versions` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Get version
        request.get(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/versions/1` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
    ], done);
  });

  it('Check Admin', (done) => {
    async.parallel([
      (cb) => {
        // List users
        request.get(
          { url: `${env.API_ENDPOINT}/admin/users` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Enable user
        request.post(
          { url: `${env.API_ENDPOINT}/admin/users/test@test.com/enable` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Add vendor
        request.post(
          { url: `${env.API_ENDPOINT}/admin/users/test@test.com/vendors/keboola` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Make user admin
        request.post(
          { url: `${env.API_ENDPOINT}/admin/users/test@test.com/admin` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // List apps
        request.get(
          { url: `${env.API_ENDPOINT}/admin/apps` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
      (cb) => {
        // Approve app
        request.post(
          { url: `${env.API_ENDPOINT}/admin/apps/appId/approve` },
          (err, res, body) => checkAuth(err, res, body, cb)
        );
      },
    ], done);
  });
});
