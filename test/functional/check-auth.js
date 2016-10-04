'use strict';
require('dotenv').config({path: '.env-test', silent: true});

var async = require('async');
var expect = require('chai').expect;
var request = require('request');

const vendor = process.env.FUNC_VENDOR;

var checkAuth = function(err, res, body, callback) {
  expect(err, JSON.stringify(err)).to.be.null;
  body = JSON.parse(body);
  expect(body).to.have.property('message');
  expect(body.message).to.equal('Unauthorized');
  expect(res).to.have.property('statusCode');
  expect(res.statusCode).to.equal(401);
  callback();
};

describe('check if all endpoints have auth required', function() {
  it('check apps', function(done) {
    async.parallel([
      function(callback) {
        // Get profile
        request.get({url: process.env.FUNC_API_BASE_URI + '/auth/profile'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Change password
        request.put({url: process.env.FUNC_API_BASE_URI + '/auth/profile'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Create app
        request.post({url: process.env.FUNC_API_BASE_URI + '/vendor/apps'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Get app detail
        request.get({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // List apps
        request.get({url: process.env.FUNC_API_BASE_URI + '/vendor/apps'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Approve
        request.post({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/approve'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Update app
        request.patch({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Request url to upload icons
        request.post({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/icons'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Rollback version
        request.post({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/versions/1/rollback'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // List versions
        request.get({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/versions'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Get version
        request.get({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/versions/1'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      }
    ], done);
  });

  it('check admin', function(done) {
    async.parallel([
      function(callback) {
        // List users
        request.get({url: process.env.FUNC_API_BASE_URI + '/admin/users'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Enable user
        request.post({url: process.env.FUNC_API_BASE_URI + '/admin/users/test@test.com/enable'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Make user admin
        request.post({url: process.env.FUNC_API_BASE_URI + '/admin/users/test@test.com/admin'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // List apps
        request.get({url: process.env.FUNC_API_BASE_URI + '/admin/apps'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      },
      function(callback) {
        // Approve app
        request.post({url: process.env.FUNC_API_BASE_URI + '/admin/apps/appId/approve'}, function(err, res, body) {
          checkAuth(err, res, body, callback);
        });
      }
    ], done);
  });
});
