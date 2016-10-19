'use strict';

const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const env = require('../../lib/env').load();
const expect = require('chai').expect;
const fs = require('fs');
const mysql = require('mysql');
const request = require('request');

const rds = mysql.createConnection({
  host: env.RDS_HOST,
  port: env.RDS_PORT,
  user: env.RDS_USER,
  password: env.RDS_PASSWORD,
  database: env.RDS_DATABASE,
  ssl: env.RDS_SSL,
  multipleStatements: true,
});

const vendor = process.env.FUNC_VENDOR;
const appName1 = `a1_${Date.now()}`;
const appName2 = `a2_${Date.now()}`;
const appId1 = `${vendor}.appName1`;
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
          expect(err).to.be.null;
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
    ], done);
  });

  it('new app flow', (done) => {
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
            id: appName1,
            name: appName1,
            type: 'extractor',
          },
        }, (err, res, body) => {
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.be.empty;
          callback();
        });
      },
      function (callback) {
        // Create second app
        request.post({
          url: `${env.API_ENDPOINT}/vendor/apps`,
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
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.be.empty;
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
          expect(err).to.be.null;
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
          expect(err).to.be.null;
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
          expect(err).to.be.null;
          expect(body).to.have.property('error');
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
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.have.property('error');
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
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.be.empty;
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
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.have.property('error');
          expect(body.error).to.include('App icon');
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
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.not.have.property('error');
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
          expect(err).to.be.null;
          expect(body).to.be.empty;
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
          expect(err).to.be.null;
          expect(body).to.be.empty;
          callback();
        }));
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
            expect(err).to.be.null;
            expect(body).to.be.equal('null');
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
          expect(err).to.be.null;
          expect(body, JSON.stringify(body)).to.not.have.property('error');
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
          expect(err).to.be.null;
          expect(body).to.not.have.property('error');
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
          expect(err).to.be.null;
          const body = JSON.parse(bodyRaw);
          expect(body, JSON.stringify(body)).to.not.have.property('error');
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
          expect(err).to.be.null;
          expect(body).to.not.have.property('error');
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
          expect(err).to.be.null;
          const body = JSON.parse(bodyRaw);
          expect(body, JSON.stringify(body)).to.not.have.property('error');
          expect(body).to.have.property('id');
          callback();
        });
      },
      function (callback) {
        // Public app list versions
        request.get({
          url: `${env.API_ENDPOINT}/apps/${appId1}/versions`,
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null;
          const body = JSON.parse(bodyRaw);
          expect(body, JSON.stringify(body)).to.not.have.property('error');
          expect(body).to.have.length.above(0);
          callback();
        });
      },
    ], done);
  });

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
