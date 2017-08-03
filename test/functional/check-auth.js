'use strict';

require('longjohn');
const axios = require('axios');
const expect = require('unexpected');

const checkAuth = (method, url) =>
  expect(axios({ method, url }), 'to be rejected with error satisfying', { response: { status: 401 } });


describe('Check if all intended endpoints have auth required', () => {
  it('Check Auth', () =>
    // User profile
    checkAuth('get', `${process.env.API_ENDPOINT}/auth/profile`)
      // Enable MFA
      .then(() => checkAuth('post', `${process.env.API_ENDPOINT}/auth/mfa/phone`)));

  it('Check Apps', () =>
    // Create app
    checkAuth('post', `${process.env.API_ENDPOINT}/vendors/keboola/apps`)
      // List apps
      .then(() => checkAuth('get', `${process.env.API_ENDPOINT}/vendors/keboola/apps`))
      // Get app
      .then(() => checkAuth('get', `${process.env.API_ENDPOINT}/vendors/keboola/apps/app`))
      // Update app
      .then(() => checkAuth('patch', `${process.env.API_ENDPOINT}/vendors/keboola/apps/app`))
      // Approve app
      .then(() => checkAuth('post', `${process.env.API_ENDPOINT}/vendors/keboola/apps/app/approve`))
      // List versions
      .then(() => checkAuth('get', `${process.env.API_ENDPOINT}/vendors/keboola/apps/versions`))
      // Get version
      .then(() => checkAuth('get', `${process.env.API_ENDPOINT}/vendors/keboola/apps/app/versions/1`))
      // Rollback version
      .then(() => checkAuth('post', `${process.env.API_ENDPOINT}/vendors/keboola/apps/app/versions/1/rollback`))
      // Request icon upload
      .then(() => checkAuth('post', `${process.env.API_ENDPOINT}/vendors/keboola/apps/app/icon`)));

  it('Check Admin', () =>
    // Approve app
    checkAuth('post', `${process.env.API_ENDPOINT}/admin/apps/appId/approve`)
      // Get app
      .then(() => checkAuth('get', `${process.env.API_ENDPOINT}/admin/apps/appId`))
      // List apps
      .then(() => checkAuth('get', `${process.env.API_ENDPOINT}/admin/apps`))
      // Update app
      .then(() => checkAuth('patch', `${process.env.API_ENDPOINT}/admin/apps/appId`))
      // List users
      .then(() => checkAuth('get', `${process.env.API_ENDPOINT}/admin/users`))
      // Make user admin
      .then(() => checkAuth('post', `${process.env.API_ENDPOINT}/admin/users/test@test.com/admin`))
      // Add user to vendor
      .then(() => checkAuth('post', `${process.env.API_ENDPOINT}/admin/users/user@email.com/vendors/keboola`))
      // Remove user from vendor
      .then(() => checkAuth('delete', `${process.env.API_ENDPOINT}/admin/users/user@email.com/vendors/keboola`))
      // Create vendor
      .then(() => checkAuth('post', `${process.env.API_ENDPOINT}/admin/vendors`))
      // Approve vendor
      .then(() => checkAuth('post', `${process.env.API_ENDPOINT}/admin/vendors/keboola/approve`))
      // List app changes
      .then(() => checkAuth('get', `${process.env.API_ENDPOINT}/admin/changes`)));
});
