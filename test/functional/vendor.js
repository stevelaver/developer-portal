'use strict';
require('dotenv').config();

var async = require('async');
var aws = require('aws-sdk');
var db = require('../../vendor/db');
var expect = require('chai').expect;
var fs = require('fs');
var mysql = require('mysql');
var request = require('request');

var rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST,
  user: process.env.FUNC_RDS_USER,
  password: process.env.FUNC_RDS_PASSWORD,
  database: process.env.FUNC_RDS_DATABASE,
  ssl: process.env.RDS_SSL ? 'Amazon RDS' : false,
  multipleStatements: true
});

const vendor = process.env.FUNC_VENDOR;
const appName1 = 'a1_' + Date.now();
const appName2 = 'a2_' + Date.now();
const appId1 = vendor+'.'+appName1;
var token;

describe('vendor', function() {
  before(function(done) {
    async.waterfall([
      function(callback) {
        request.post({
          url: process.env.FUNC_API_BASE_URI + '/auth/login',
          json: true,
          body: {
            email: process.env.FUNC_USER_EMAIL,
            password: process.env.FUNC_USER_PASSWORD
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.have.property('token');
          token = body.token;
          callback();
        });
      },
      function(callback) {
        rds.query('DELETE FROM apps WHERE vendor_id=?', vendor, function(err,res) {
          callback();
        });
      }
    ], done);
  });

  it('new app flow', function(done) {
    async.waterfall([
      function(callback) {
        // Create app
        request.post({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps',
          headers: {
            Authorization: token
          },
          json: true,
          body: {
            id: appName1,
            name: appName1,
            type: 'reader'
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          expect(body.id).to.be.equal(appId1);
          callback();
        });
      },
      function(callback) {
        // Create second app
        request.post({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps',
          headers: {
            Authorization: token
          },
          json: true,
          body: {
            id: appName2,
            name: appName2,
            type: 'reader'
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          expect(body.id).to.be.equal(vendor+'.'+appName2);
          callback();
        });
      },
      function(callback) {
        // Get app detail
        request.get({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/'+appId1,
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.have.property('id');
          expect(body.id).to.be.equal(appId1);
          callback();
        });
      },
      function(callback) {
        // List apps
        request.get({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps',
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.have.lengthOf(2);
          expect(body[0]).to.have.property('id');
          expect(body[0].id).to.be.oneOf([vendor+'.'+appName1, vendor+'.'+appName2]);
          expect(body[1]).to.have.property('id');
          expect(body[1].id).to.be.oneOf([vendor+'.'+appName1, vendor+'.'+appName2]);
          callback();
        });
      },
      function(callback) {
        // Public app profile should not exist
        request.get({
          url: process.env.FUNC_API_BASE_URI + '/apps/'+appId1
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.have.property('errorMessage');
          callback();
        });
      },
      function(callback) {
        // Approve should fail
        request.post({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/' + appId1 + '/approve',
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.have.property('errorMessage');
          callback();
        });
      },
      function(callback) {
        // Update app
        request.patch({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/' + appId1,
          headers: {
            Authorization: token
          },
          json: true,
          body: {
            image_url: 'https://quay.io/repository/keboola/test-extractor',
            image_tag: 'latest',
            short_description: 'Get your test data',
            long_description: 'Get your test data with our Test Extractor',
            license_url: 'https://github.com/keboola/test-extractor/blob/master/LICENSE',
            documentation_url: 'https://github.com/keboola/test-extractor/blob/master/README.md'
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          expect(body.id).to.be.equal(appId1);
          callback();
        });
      },
      function(callback) {
        // Approve should fail on missing icons
        request.post({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/' + appId1 + '/approve',
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.have.property('errorMessage');
          expect(body.errorMessage).to.include('App icon');
          callback();
        });
      },
      function(callback) {
        // Request url to upload icons
        request.post({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/' + appId1 + '/icons',
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body, JSON.stringify(body)).to.have.property('32');
          expect(body, JSON.stringify(body)).to.have.property('64');
          callback(null, body);
        });
      },
      function(icons, callback) {
        // Upload 32px icon
        var stats = fs.statSync(__dirname+'/icon.png');
        fs.createReadStream(__dirname+'/icon.png').pipe(request.put({
          url: icons['32'],
          headers: {
            'Content-Length': stats['size']
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.be.empty;
          callback(null, icons);
        }));
      },
      function(icons, callback) {
        // Upload 64px icon
        var stats = fs.statSync(__dirname+'/icon.png');
        fs.createReadStream(__dirname+'/icon.png').pipe(request.put({
          url: icons['64'],
          headers: {
            'Content-Length': stats['size']
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.be.empty;
          callback();
        }));
      },
      function(callback) {
        // Approve should succeed
        request.post({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/' + appId1 + '/approve',
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.be.equal('null');
          callback();
        });
      },
      function(callback) {
        // Manual approval
        rds.query('UPDATE apps SET is_approved=1 WHERE id=?', appId1, function(err) {
          callback(err);
        });
      },
      function(callback) {
        // Public app profile should not exist
        request.get({
          url: process.env.FUNC_API_BASE_URI + '/apps/'+appId1
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.have.property('errorMessage');
          callback();
        });
      },
      function(callback) {
        // Create version
        request.post({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/' + appId1 + '/versions',
          headers: {
            Authorization: token
          },
          json: true,
          body: {
            version: '1.0.0'
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          callback();
        });
      },
      function(callback) {
        // Public app profile should finally exist
        request.get({
          url: process.env.FUNC_API_BASE_URI + '/apps/'+appId1
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          callback();
        });
      },
      function(callback) {
        // List versions
        request.get({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/'+appId1+'/versions',
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.length(1);
          callback();
        });
      },
      function(callback) {
        // Get version
        request.get({
          url: process.env.FUNC_API_BASE_URI + '/vendor/apps/'+appId1+'/versions/1.0.0',
          headers: {
            Authorization: token
          }
        }, function(err, res, body) {
          expect(err).to.be.null;
          body = JSON.parse(body);
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          callback();
        });
      },
      function(callback) {
        // Public apps list should have at least one result
        request.get({
          url: process.env.FUNC_API_BASE_URI + '/apps'
        }, function(err, res, body) {
          body = JSON.parse(body);
          expect(err).to.be.null;
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.length.above(0);
          expect(body[0]).to.have.property('id');
          callback();
        });
      }
    ], done);
  });

  after(function(done) {
    async.waterfall([
      function(callback) {
        rds.query('DELETE FROM apps WHERE vendor_id=?', vendor, function(err,res) {
          callback();
        });
      },
      function(callback) {
        // Clear icons from s3
        var s3 = new aws.S3();
        s3.listObjects({ Bucket: process.env.S3_BUCKET_ICONS, Prefix: appId1 + '/' }, function(err, data) {
          if (data && data.hasOwnProperty('Contents')) {
            async.each(data.Contents, function(file, callbackLocal) {
              s3.deleteObject({ Bucket: process.env.S3_BUCKET_ICONS, Key: file.Key }, callbackLocal);
            }, callback);
          }
        });
      }
    ], done);
  });
});