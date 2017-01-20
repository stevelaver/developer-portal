'use strict';

require('dotenv').config({ path: '.env-test', silent: true });
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const env = require('../../lib/env').load();
const fs = require('fs');
const mysql = require('mysql');
const request = require('request');

const chai = require('chai');
const dirtyChai = require('dirty-chai');

const expect = chai.expect;
chai.use(dirtyChai);

const rds = mysql.createConnection({
  host: env.RDS_HOST,
  port: env.RDS_PORT,
  user: env.RDS_USER,
  password: env.RDS_PASSWORD,
  database: env.RDS_DATABASE,
  ssl: 'Amazon RDS',
  multipleStatements: true,
});

const vendor = process.env.FUNC_VENDOR;
const appName1 = `a1_${Date.now()}`;
const appName2 = `a2_${Date.now()}`;
const appId1 = `${vendor}.${appName1}`;
let token;

describe('apps', () => {
  before((done) => {
    async.waterfall([
      function (callback) {
        request.post({
          url: `${env.API_ENDPOINT}/auth/login`,
          json: true,
          body: {
            email: process.env.FUNC_USER_EMAIL,
            password: process.env.FUNC_USER_PASSWORD,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('token');
          token = body.token;
          callback();
        });
      },
      function (callback) {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          vendor,
          err => callback(err)
        );
      },
      function (cb) {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
          [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
          err => cb(err)
        );
      },
    ], done);
  });

  it('new app flow', (done) => {
    async.waterfall([
      function (callback) {
        // Try to create app with forbidden attribute
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: appName1,
            name: appName1,
            type: 'extractor',
            isApproved: true,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorType');
          expect(body.errorType).to.be.equal('UnprocessableEntity');
          callback();
        });
      },
      function (callback) {
        // Create app
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: appName1,
            name: appName1,
            type: 'extractor',
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          callback();
        });
      },
      function (callback) {
        // Create second app
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: appName2,
            name: appName2,
            type: 'extractor',
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          callback();
        });
      },
      function (callback) {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId1}`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, bodyRaw).to.have.property('id');
          expect(body.id).to.be.equal(appId1);
          callback();
        });
      },
      function (callback) {
        // List apps
        request.get({
          url: `${env.API_ENDPOINT}/vendor/apps`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.lengthOf(2);
          expect(body[0]).to.have.property('id');
          expect(body[0].id).to.be.oneOf([`${vendor}.${appName1}`, `${vendor}.${appName2}`]);
          expect(body[1]).to.have.property('id');
          expect(body[1].id).to.be.oneOf([`${vendor}.${appName1}`, `${vendor}.${appName2}`]);
          callback();
        });
      },
      function (callback) {
        // Public app profile should not exist
        request.get({
          url: `${env.API_ENDPOINT}/apps/${appId1}`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.have.property('errorMessage');
          callback();
        });
      },
      function (callback) {
        // Approve should fail
        request.post({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId1}/approve`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorMessage');
          callback();
        });
      },
      function (callback) {
        // Update app
        request.patch({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId1}`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            repository: {
              type: 'quay',
              uri: 'keboola/test-extractor',
              tag: 'latest',
            },
            shortDescription: 'Get your test data',
            longDescription: 'Get your test data with our Test Extractor',
            licenseUrl: 'https://github.com/keboola/test-extractor/blob/master/LICENSE',
            documentationUrl: 'https://github.com/keboola/test-extractor/blob/master/README.md',
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          callback();
        });
      },
      function (callback) {
        // Approve should fail on missing icons
        request.post({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId1}/approve`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorMessage');
          expect(body.errorMessage).to.include('App icon');
          callback();
        });
      },
      function (callback) {
        // Request url to upload icons
        request.post({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId1}/icons`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body, JSON.stringify(body)).to.have.property('32');
          expect(body, JSON.stringify(body)).to.have.property('64');
          callback(null, body);
        });
      },
      function (icons, callback) {
        // Upload 32px icon
        const stats = fs.statSync(`${__dirname}/icon.png`);
        fs.createReadStream(`${__dirname}/icon.png`).pipe(request.put({
          url: icons['32'],
          headers: {
            'Content-Length': stats.size,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body).to.be.empty();
          callback(null, icons);
        }));
      },
      function (icons, callback) {
        // Upload 64px icon
        const stats = fs.statSync(`${__dirname}/icon.png`);
        fs.createReadStream(`${__dirname}/icon.png`).pipe(request.put({
          url: icons['64'],
          headers: {
            'Content-Length': stats.size,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body).to.be.empty();
          callback();
        }));
      },
      function (callback) {
        setTimeout(() => {
          callback();
        }, 10000);
      },
      function (callback) {
        // Approve should succeed
        // Wait few seconds if icon handling lambda has delay
        setTimeout(() => {
          request.post({
            url: `${env.API_ENDPOINT}/vendor/apps/${appId1}/approve`,
            headers: {
              Authorization: token,
            },
          }, (err, res, body) => {
            expect(err).to.be.null();
            expect(body).to.be.empty();
            callback();
          });
        }, 5000);
      },
      function (callback) {
        // Manual approval
        rds.query(
          'UPDATE apps SET isApproved=1 WHERE id=?',
          appId1,
          err => callback(err)
        );
      },
      function (callback) {
        // Public app profile should exist now
        request.get({
          url: `${env.API_ENDPOINT}/apps/${appId1}`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          callback();
        });
      },
      function (callback) {
        // List versions
        request.get({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId1}/versions`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.length.above(1);
          callback();
        });
      },
      function (callback) {
        // Get version
        request.get({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId1}/versions/1`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          callback();
        });
      },
      function (callback) {
        // Public apps list should have at least one result
        request.get({
          url: `${env.API_ENDPOINT}/apps`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.length.above(0);
          expect(body[0]).to.have.property('id');
          callback();
        });
      },
      function (callback) {
        // Public app version
        request.get({
          url: `${env.API_ENDPOINT}/apps/${appId1}/versions/1`,
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          callback();
        });
      },
      function (callback) {
        // Public app list versions
        request.get({
          url: `${env.API_ENDPOINT}/apps/${appId1}/versions`,
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.length.above(0);
          callback();
        });
      },
    ], done);
  });

  it('app with permissions flow', (done) => {
    const appName3 = `a4_${Date.now()}`;
    const appId3 = `${vendor}.${appName3}`;
    async.waterfall([
      function (callback) {
        // Create app should fail on wrong permissions schema
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: appName3,
            name: appName3,
            type: 'extractor',
            permissions: [
              {
                stack: 'stack',
                projects: 2,
              },
            ],
            isPublic: false,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorMessage');
          callback();
        });
      },
      function (callback) {
        rds.query(
          'DELETE FROM stacks WHERE name=?',
          'stack',
          err => callback(err)
        );
      },
      function (callback) {
        // Create app should fail on non-existing stack
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: appName3,
            name: appName3,
            type: 'extractor',
            permissions: [
              {
                stack: 'stack',
                projects: [2],
              },
            ],
            isPublic: false,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorMessage');
          callback();
        });
      },
      function (callback) {
        rds.query(
          'INSERT INTO stacks SET name=?',
          'stack',
          err => callback(err)
        );
      },
      function (callback) {
        // Create app
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: appName3,
            name: appName3,
            type: 'extractor',
            permissions: [
              {
                stack: 'stack',
                projects: [2],
              },
            ],
            isPublic: false,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          callback();
        });
      },
      function (callback) {
        // Update app
        request.patch({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId3}`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            permissions: [
              {
                stack: 'stack',
                projects: [2, 3],
              },
            ],
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          callback();
        });
      },
      function (callback) {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId3}`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, bodyRaw).to.have.property('id');
          expect(body, bodyRaw).to.have.property('permissions');
          expect(body.permissions, bodyRaw).to.have.length(1);
          expect(body.permissions[0], bodyRaw).to.have.property('stack');
          expect(body.permissions[0].stack).to.equal('stack');
          expect(body.permissions[0].projects).to.deep.equal([2, 3]);
          expect(body.id).to.be.equal(appId3);
          callback();
        });
      },
      function (callback) {
        // Manual approval
        rds.query(
          'UPDATE apps SET isApproved=1 WHERE id=?',
          appId3,
          err => callback(err)
        );
      },
      function (callback) {
        // Public app profile should not exist
        request.get({
          url: `${env.API_ENDPOINT}/apps/${appId3}`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorType');
          expect(body.errorType).to.be.equal('NotFound');
          callback();
        });
      },
      function (callback) {
        // Public apps list should not contain the app
        request.get({
          url: `${env.API_ENDPOINT}/apps`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.not.have.property('errorMessage');
          expect(_.map(body, app => app.id)).to.not.include(appId3);
          callback();
        });
      },
    ], done);
  });

  /* it('ECR', (done) => {
    const appName = `a3_${Date.now()}`;
    const appId = `${vendor}.${appName}`;
    async.waterfall([
      function (callback) {
        // Create app
        request.post({
          url: `${env.API_ENDPOINT}/vendor/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: appName,
            name: appName,
            type: 'extractor',
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          callback();
        });
      },
      function (callback) {
        // Create repository
        request.post({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId}/repository`,
          headers: {
            Authorization: token,
          },
        }, (err) => {
          expect(err).to.be.null();
          callback();
        });
      },
      function (callback) {
        // Get repository credentials
        request.get({
          url: `${env.API_ENDPOINT}/vendor/apps/${appId}/repository`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.not.have.property('errorMessage');
          callback();
        });
      },
      function (callback) {
        // Delete repository
        const ecr = new aws.ECR({ region: env.REGION });
        ecr.deleteRepository({
          force: true,
          repositoryName: `${env.SERVICE_NAME}/${appId}`,
        }, callback);
      },
    ], done);
  }); */

  after((done) => {
    async.waterfall([
      function (callback) {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          vendor,
          err => callback(err)
        );
      },
      function (callback) {
        // Clear icons from s3
        const s3 = new aws.S3();
        s3.listObjects(
          { Bucket: env.S3_BUCKET, Prefix: `${appId1}/` },
          (err, data) => {
            if (data && _.has(data, 'Contents')) {
              async.each(data.Contents, (file, cb) => {
                s3.deleteObject({ Bucket: env.S3_BUCKET, Key: file.Key }, cb);
              }, callback);
            } else {
              callback();
            }
          }
        );
      },
    ], done);
  });
});
