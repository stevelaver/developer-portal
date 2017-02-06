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

describe('Apps', () => {
  before((done) => {
    async.waterfall([
      (cb) => {
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
          cb();
        });
      },
      (cb) => {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          vendor,
          err => cb(err)
        );
      },
      (cb) => {
        rds.query(
          'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
          [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
          err => cb(err)
        );
      },
    ], done);
  });

  it('New App', (done) => {
    async.waterfall([
      (cb) => {
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
          cb();
        });
      },
      (cb) => {
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
          cb();
        });
      },
      (cb) => {
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
          cb();
        });
      },
      (cb) => {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, bodyRaw).to.have.property('id');
          expect(body.id).to.be.equal(appId1);
          cb();
        });
      },
      (cb) => {
        // List apps
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
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
          cb();
        });
      },
      (cb) => {
        // Public app profile should not exist
        request.get({
          url: `${env.API_ENDPOINT}/apps/${vendor}/${appId1}`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.have.property('errorMessage');
          cb();
        });
      },
      (cb) => {
        // Approve should fail
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/approve`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorMessage');
          cb();
        });
      },
      (cb) => {
        // Update app
        request.patch({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}`,
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
          cb();
        });
      },
      (cb) => {
        // Approve should fail on missing icons
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/approve`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorMessage');
          expect(body.errorMessage).to.include('App icon');
          cb();
        });
      },
      (cb) => {
        // Request url to upload icons
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/icon`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body, JSON.stringify(body)).to.have.property('link');
          cb(null, body);
        });
      },
      (icons, cb) => {
        // Upload icon
        const stats = fs.statSync(`${__dirname}/icon.png`);
        fs.createReadStream(`${__dirname}/icon.png`).pipe(request.put({
          url: icons.link,
          headers: {
            'Content-Length': stats.size,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body).to.be.empty();
          cb();
        }));
      },
      (cb) => {
        setTimeout(() => {
          cb();
        }, 10000);
      },
      (cb) => {
        // Approve should succeed
        // Wait few seconds if icon handling lambda has delay
        setTimeout(() => {
          request.post({
            url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/approve`,
            headers: {
              Authorization: token,
            },
          }, (err, res, body) => {
            expect(err).to.be.null();
            expect(body).to.be.empty();
            cb();
          });
        }, 5000);
      },
      (cb) => {
        // Manual approval
        rds.query(
          'UPDATE apps SET isApproved=1 WHERE id=?',
          appId1,
          err => cb(err)
        );
      },
      (cb) => {
        // Public app profile should exist now
        request.get({
          url: `${env.API_ENDPOINT}/apps/${vendor}/${appId1}`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          cb();
        });
      },
      (cb) => {
        // List versions
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/versions`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.length.above(1);
          cb();
        });
      },
      (cb) => {
        // Get version
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/versions/1`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, JSON.stringify(body)).to.not.have.property('errorMessage');
          expect(body).to.have.property('id');
          cb();
        });
      },
      (cb) => {
        // Public apps list should have at least one result
        request.get({
          url: `${env.API_ENDPOINT}/apps`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.not.have.property('errorMessage');
          expect(body).to.have.length.above(0);
          expect(body[0]).to.have.property('id');
          cb();
        });
      },
    ], done);
  });

  it('App With Permissions', (done) => {
    const appName3 = `a4_${Date.now()}`;
    const appId3 = `${vendor}.${appName3}`;
    async.waterfall([
      (cb) => {
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
          cb();
        });
      },
      (cb) => {
        rds.query(
          'DELETE FROM stacks WHERE name=?',
          'stack',
          err => cb(err)
        );
      },
      (cb) => {
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
          cb();
        });
      },
      (cb) => {
        rds.query(
          'INSERT INTO stacks SET name=?',
          'stack',
          err => cb(err)
        );
      },
      (cb) => {
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
          cb();
        });
      },
      (cb) => {
        // Update app
        request.patch({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId3}`,
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
          cb();
        });
      },
      (cb) => {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId3}`,
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
          cb();
        });
      },
      (cb) => {
        // Manual approval
        rds.query(
          'UPDATE apps SET isApproved=1 WHERE id=?',
          appId3,
          err => cb(err)
        );
      },
      (cb) => {
        // Public app profile should not exist
        request.get({
          url: `${env.API_ENDPOINT}/apps/${vendor}/${appId3}`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.have.property('errorType');
          expect(body.errorType).to.be.equal('NotFound');
          cb();
        });
      },
      (cb) => {
        // Public apps list should not contain the app
        request.get({
          url: `${env.API_ENDPOINT}/apps`,
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.not.have.property('errorMessage');
          expect(_.map(body, app => app.id)).to.not.include(appId3);
          cb();
        });
      },
    ], done);
  });

  it('App Version Rollback', (done) => {
    const appName4 = `a4_${Date.now()}`;
    const appId4 = `${vendor}.${appName4}`;
    const newAppName4 = `a44_${Date.now()}`;
    async.waterfall([
      (cb) => {
        // Create app
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            id: appName4,
            name: appName4,
            type: 'extractor',
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      (cb) => {
        // Update app
        request.patch({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId4}`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            name: newAppName4,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      (cb) => {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId4}`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, bodyRaw).to.have.property('name');
          expect(body.name).to.equal(newAppName4);
          expect(body, bodyRaw).to.have.property('version');
          cb();
        });
      },
      (cb) => {
        // Rollback
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId4}/versions/1/rollback`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            name: newAppName4,
          },
        }, (err, res, body) => {
          expect(err).to.be.null();
          expect(body, JSON.stringify(body)).to.be.empty();
          cb();
        });
      },
      (cb) => {
        // Get app detail
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId4}`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body, bodyRaw).to.have.property('name');
          expect(body.name).to.equal(appName4);
          expect(body, bodyRaw).to.have.property('version');
          cb(null, body.version);
        });
      },
    ], done);
  });

  it('Public Apps Listing', (done) => {
    let testApp1;
    let testApp2;
    async.waterfall([
      (cb) => {
        rds.query(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
          [`${vendor}.${appId1}List1`, vendor, 'test1'],
          err => cb(err)
        );
      },
      (cb) => {
        rds.query(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
          [`${vendor}.${appId1}List2`, vendor, 'test2'],
          err => cb(err)
        );
      },
      (cb) => {
        // Public list all
        request.get({
          url: `${env.API_ENDPOINT}/apps`,
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.length.of.at.least(2);
          expect(body[0]).to.have.property('name');
          testApp1 = body[0].name;
          expect(body[1]).to.have.property('name');
          testApp2 = body[1].name;
          cb();
        });
      },
      (cb) => {
        // Public list limit
        request.get({
          url: `${env.API_ENDPOINT}/apps?offset=0&limit=1`,
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.lengthOf(1);
          expect(body[0]).to.have.property('name');
          expect(body[0].name).to.be.equal(testApp1);
          cb();
        });
      },
      (cb) => {
        // Public list limit
        request.get({
          url: `${env.API_ENDPOINT}/apps?offset=1&limit=1`,
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.lengthOf(1);
          expect(body[0]).to.have.property('name');
          expect(body[0].name).to.be.equal(testApp2);
          cb();
        });
      },
    ], done);
  });

  it('Vendor Apps Listing', (done) => {
    let testApp1;
    let testApp2;
    async.waterfall([
      (cb) => {
        rds.query(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
          [`${vendor}.${appId1}List3`, vendor, 'test1'],
          err => cb(err)
        );
      },
      (cb) => {
        rds.query(
          'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
          [`${vendor}.${appId1}List4`, vendor, 'test2'],
          err => cb(err)
        );
      },
      (cb) => {
        // Vendor list all
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.length.of.at.least(2);
          expect(body[0]).to.have.property('name');
          testApp1 = body[0].name;
          expect(body[1]).to.have.property('name');
          testApp2 = body[1].name;
          cb();
        });
      },
      (cb) => {
        // Vendor list limit
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps?offset=0&limit=1`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.lengthOf(1);
          expect(body[0]).to.have.property('name');
          expect(body[0].name).to.be.equal(testApp1);
          cb();
        });
      },
      (cb) => {
        // Vendor list limit
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps?offset=1&limit=1`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          expect(err).to.be.null();
          const body = JSON.parse(bodyRaw);
          expect(body, bodyRaw).to.not.have.property('errorMessage');
          expect(body).to.have.lengthOf(1);
          expect(body[0]).to.have.property('name');
          expect(body[0].name).to.be.equal(testApp2);
          cb();
        });
      },
    ], done);
  });

  /* it('ECR', (done) => {
    const appName = `a3_${Date.now()}`;
    const appId = `${vendor}.${appName}`;
    async.waterfall([
      (cb) => {
        // Create app
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
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
          cb();
        });
      },
      (cb) => {
        // Create repository
        request.post({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId}/repository`,
          headers: {
            Authorization: token,
          },
        }, (err) => {
          expect(err).to.be.null();
          cb();
        });
      },
      (cb) => {
        // Get repository credentials
        request.get({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId}/repository`,
          headers: {
            Authorization: token,
          },
        }, (err, res, bodyRaw) => {
          const body = JSON.parse(bodyRaw);
          expect(err).to.be.null();
          expect(body).to.not.have.property('errorMessage');
          cb();
        });
      },
      (cb) => {
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
      (cb) => {
        rds.query(
          'DELETE FROM apps WHERE vendor=?',
          vendor,
          err => cb(err)
        );
      },
      (cb) => {
        // Clear icons from s3
        const s3 = new aws.S3();
        s3.listObjects(
          { Bucket: env.S3_BUCKET, Prefix: `${appId1}/` },
          (err, data) => {
            if (data && _.has(data, 'Contents')) {
              async.each(data.Contents, (file, cb2) => {
                s3.deleteObject({ Bucket: env.S3_BUCKET, Key: file.Key }, cb2);
              }, cb);
            } else {
              cb();
            }
          }
        );
      },
    ], done);
  });
});
