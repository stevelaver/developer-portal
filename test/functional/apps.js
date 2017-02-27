'use strict';

require('dotenv').config({ path: '.env-test', silent: true });
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const expect = require('unexpected');
const fs = require('fs');
const mysql = require('mysql');
const request = require('request');

const env = require('../../lib/env').load();

const rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST ? process.env.FUNC_RDS_HOST : env.RDS_HOST,
  port: process.env.FUNC_RDS_PORT ? process.env.FUNC_RDS_PORT : env.RDS_PORT,
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'token');
          token = res.body.token;
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 422);
          expect(res.body, 'to have key', 'errorType');
          expect(res.body.errorType, 'to be', 'UnprocessableEntity');
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'id');
          expect(res.body.id, 'to be', appId1);
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have an item satisfying', (item) => {
            expect(item, 'to have key', 'id');
            expect(item.id, 'to be', `${vendor}.${appName1}`);
          });
          expect(res.body, 'to have an item satisfying', (item) => {
            expect(item, 'to have key', 'id');
            expect(item.id, 'to be', `${vendor}.${appName2}`);
          });
          cb();
        });
      },
      (cb) => {
        // Public app profile should not exist
        request.get({
          url: `${env.API_ENDPOINT}/apps/${vendor}/${appId1}`,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 404);
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 400);
          cb();
        });
      },
      (cb) => {
        // Update to isPublic should fail
        request.patch({
          url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}`,
          headers: {
            Authorization: token,
          },
          json: true,
          body: {
            isPublic: true,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 400);
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 400);
          expect(res.body, 'to have key', 'errorMessage');
          expect(res.body.errorMessage, 'to contain', 'App icon');
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'link');
          cb(null, res.body);
        });
      },
      (prevRes, cb) => {
        // Upload icon
        const stats = fs.statSync(`${__dirname}/icon.png`);
        fs.createReadStream(`${__dirname}/icon.png`).pipe(request.put({
          url: prevRes.link,
          headers: {
            'Content-Length': stats.size,
          },
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
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
          }, (err, res) => {
            expect(res.statusCode, 'to be', 202);
            cb();
          });
        }, 5000);
      },
      (cb) => {
        // Manual approval
        rds.query(
          'UPDATE apps SET isApproved=1, isPublic=1 WHERE id=?',
          appId1,
          err => cb(err)
        );
      },
      (cb) => {
        // Public app profile should exist now
        request.get({
          url: `${env.API_ENDPOINT}/apps/${vendor}/${appId1}`,
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'id');
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body.length, 'to be positive');
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'id');
          cb();
        });
      },
      (cb) => {
        // Public apps list should have at least one result
        request.get({
          url: `${env.API_ENDPOINT}/apps`,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body.length, 'to be positive');
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 422);
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 422);
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
        // List stacks
        request.get({
          url: `${env.API_ENDPOINT}/stacks`,
          json: true,
        }, (err, res) => {
          expect(res.body, 'to contain', 'stack');
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'id');
          expect(res.body.id, 'to be', appId3);
          expect(res.body, 'to have key', 'permissions');
          expect(res.body.permissions, 'to have length', 1);
          expect(res.body.permissions[0], 'to have key', 'stack');
          expect(res.body.permissions[0].stack, 'to be', 'stack');
          expect(res.body.permissions[0], 'to have key', 'projects');
          expect(res.body.permissions[0].projects, 'to equal', [2, 3]);
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 404);
          cb();
        });
      },
      (cb) => {
        // Public apps list should not contain the app
        request.get({
          url: `${env.API_ENDPOINT}/apps`,
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(_.map(res.body, app => app.id), 'not to contain', appId3);
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 201);
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'name');
          expect(res.body.name, 'to be', newAppName4);
          expect(res.body, 'to have key', 'version');
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
        }, (err, res) => {
          expect(res.statusCode, 'to be', 204);
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have key', 'name');
          expect(res.body.name, 'to be', appName4);
          expect(res.body, 'to have key', 'version');
          cb();
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body.length, 'to be greater than or equal to', 2);
          expect(res.body[0], 'to have key', 'name');
          testApp1 = res.body[0].name;
          expect(res.body[1], 'to have key', 'name');
          testApp2 = res.body[1].name;
          cb();
        });
      },
      (cb) => {
        // Public list limit
        request.get({
          url: `${env.API_ENDPOINT}/apps?offset=0&limit=1`,
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have length', 1);
          expect(res.body[0], 'to have key', 'name');
          expect(res.body[0].name, 'to be', testApp1);
          cb();
        });
      },
      (cb) => {
        // Public list limit
        request.get({
          url: `${env.API_ENDPOINT}/apps?offset=1&limit=1`,
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have length', 1);
          expect(res.body[0], 'to have key', 'name');
          expect(res.body[0].name, 'to be', testApp2);
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body.length, 'to be greater than or equal to', 2);
          expect(res.body[0], 'to have key', 'name');
          testApp1 = res.body[0].name;
          expect(res.body[1], 'to have key', 'name');
          testApp2 = res.body[1].name;
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have length', 1);
          expect(res.body[0], 'to have key', 'name');
          expect(res.body[0].name, 'to be', testApp1);
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
          json: true,
        }, (err, res) => {
          expect(res.statusCode, 'to be', 200);
          expect(res.body, 'to have length', 1);
          expect(res.body[0], 'to have key', 'name');
          expect(res.body[0].name, 'to be', testApp2);
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
