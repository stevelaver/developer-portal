'use strict';
require('dotenv').config();

var async = require('async');
var expect = require('chai').expect;
var request = require('request');

const vendor = process.env.FUNC_VENDOR;

describe('vendor-auth-check', function() {
  it('check if all endpoints have auth required', function(done) {
    async.waterfall([
      function(callback) {
        // Create app
        request.post({url: process.env.FUNC_API_BASE_URI + '/vendor/apps'}, function(err, res, body) {
          body = JSON.parse(body);
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      },
      function(callback) {
        // Get app detail
        request.get({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app'}, function(err, res, body) {
          body = JSON.parse(body);
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      },
      function(callback) {
        // List apps
        request.get({url: process.env.FUNC_API_BASE_URI + '/vendor/apps'}, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      },
      function(callback) {
        // Approve should fail
        request.post({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/approve'}, function(err, res, body) {
          body = JSON.parse(body);
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      },
      function(callback) {
        // Update app
        request.patch({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app'}, function(err, res, body) {
          expect(err).to.be.null;
          body = JSON.parse(body);
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      },
      function(callback) {
        // Request url to upload icons
        request.post({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/icons'}, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      },
      function(callback) {
        // Create version
        request.post({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/versions'}, function(err, res, body) {
          expect(err).to.be.null;
          body = JSON.parse(body);
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      },
      function(callback) {
        // List versions
        request.get({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/versions'}, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      },
      function(callback) {
        // Get version
        request.get({url: process.env.FUNC_API_BASE_URI + '/vendor/apps/app/versions/1.0.0'}, function(err, res, body) {
          expect(err).to.be.null;
          body = JSON.parse(body);
          expect(body).to.have.property('message');
          expect(body.message).to.equal('Unauthorized');
          callback();
        });
      }
    ], done);
  });
});