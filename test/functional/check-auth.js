'use strict';

const async = require('async');
const expect = require('unexpected');
const request = require('request');

const env = require('../../lib/env').load();


const checkAuth = function (err, res, cb) {
  const body = JSON.parse(res.body);
  expect(body, 'to have key', 'message');
  expect(res.statusCode, 'to be', 401);
  cb();
};

describe('Check if all endpoints have auth required', () => {
  it('Check Auth', (done) => {
    async.parallel([
      (cb) => {
        // Get profile
        request.get(
          { url: `${env.API_ENDPOINT}/auth/profile` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Enable MFA
        request.post(
          { url: `${env.API_ENDPOINT}/auth/mfa/phone` },
          (err, res) => checkAuth(err, res, cb)
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
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Get app detail
        request.get(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // List apps
        request.get(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Approve
        request.post(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/approve` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Update app
        request.patch(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Request url to upload icons
        request.post(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/icon` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Rollback version
        request.post(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/versions/1/rollback` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // List versions
        request.get(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/versions` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Get version
        request.get(
          { url: `${env.API_ENDPOINT}/vendors/keboola/apps/app/versions/1` },
          (err, res) => checkAuth(err, res, cb)
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
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Enable user
        request.post(
          { url: `${env.API_ENDPOINT}/admin/users/test@test.com/enable` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Create vendor
        request.post(
          { url: `${env.API_ENDPOINT}/admin/users/test@test.com/vendors/keboola` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Make user admin
        request.post(
          { url: `${env.API_ENDPOINT}/admin/users/test@test.com/admin` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // List apps
        request.get(
          { url: `${env.API_ENDPOINT}/admin/apps` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Get app
        request.get(
          { url: `${env.API_ENDPOINT}/admin/apps/app` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Update app
        request.patch(
          { url: `${env.API_ENDPOINT}/admin/apps/appId` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Approve app
        request.post(
          { url: `${env.API_ENDPOINT}/admin/apps/appId/approve` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // List changes
        request.get(
          { url: `${env.API_ENDPOINT}/admin/changes` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
      (cb) => {
        // Join vendor
        request.post(
          { url: `${env.API_ENDPOINT}/admin/vendors` },
          (err, res) => checkAuth(err, res, cb)
        );
      },
    ], done);
  });
});
