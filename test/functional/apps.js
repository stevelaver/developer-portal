'use strict';

require('longjohn');
const _ = require('lodash');
const aws = require('aws-sdk');
const axios = require('axios');
const expect = require('unexpected');
const fs = require('fs');
const mysql = require('mysql');
const Promise = require('bluebird');
const readFile = Promise.promisify(require('fs').readFile);
const wait = require('wait-promise');

const env = require('../../lib/env').load();

aws.config.setPromisesDependency(Promise);
Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

const rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST,
  port: process.env.FUNC_RDS_PORT,
  user: process.env.FUNC_RDS_USER,
  password: process.env.FUNC_RDS_PASSWORD,
  database: process.env.FUNC_RDS_DATABASE,
  ssl: process.env.FUNC_RDS_SSL,
  multipleStatements: true,
});

const vendor = process.env.FUNC_VENDOR;
const appName1 = `a1_${Date.now()}`;
const appName2 = `a2_${Date.now()}`;
const appId1 = `${vendor}.${appName1}`;
let token;

describe('Apps', () => {
  before(() =>
    axios({
      method: 'post',
      url: `${env.API_ENDPOINT}/auth/login`,
      responseType: 'json',
      data: {
        email: process.env.FUNC_USER_EMAIL,
        password: process.env.FUNC_USER_PASSWORD,
      },
    })
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        token = res.data.token;
      })
      .then(() => rds.queryAsync('DELETE FROM apps WHERE vendor=?', [vendor]))
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
      )));

  it('New App', () =>
    // Try to create app with forbidden attribute
    expect(axios({
      method: 'post',
      url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
      headers: { Authorization: token },
      responseType: 'json',
      data: {
        id: appName1,
        name: appName1,
        type: 'extractor',
        isApproved: true,
      },
    }), 'to be rejected with error satisfying', { response: { status: 422 } })
    // Create app
      .then(() => expect(axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          id: appName1,
          name: appName1,
          type: 'extractor',
        },
      }), 'to be fulfilled'))
      // Create second app
      .then(() => expect(axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          id: appName2,
          name: appName2,
          type: 'extractor',
        },
      }), 'to be fulfilled'))
      // Get app detail
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'id');
        expect(res.data.id, 'to be', appId1);
      })
      // List apps
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have an item satisfying', (item) => {
          expect(item, 'to have key', 'id');
          expect(item.id, 'to be', `${vendor}.${appName1}`);
        });
        expect(res.data, 'to have an item satisfying', (item) => {
          expect(item, 'to have key', 'id');
          expect(item.id, 'to be', `${vendor}.${appName2}`);
        });
      })
      // Public app profile should not exist
      .then(() => expect(axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/apps/${vendor}/${appId1}`,
      }), 'to be rejected with error satisfying', { response: { status: 404 } }))
      // Approve should fail
      .then(() => expect(axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/approve`,
        headers: { Authorization: token },
      }), 'to be rejected with error satisfying', { response: { status: 400 } }))
      // Update to isPublic should fail
      .then(() => expect(axios({
        method: 'patch',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}`,
        headers: { Authorization: token },
        data: {
          isPublic: true,
        },
      }), 'to be rejected with error satisfying', { response: { status: 422 } }))
      // Update should succeed
      .then(() => expect(axios({
        method: 'patch',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}`,
        headers: { Authorization: token },
        data: {
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
      }), 'to be fulfilled'))
      // Approve should fail on missing icon
      .then(() => expect(axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/approve`,
        headers: { Authorization: token },
      }), 'to be rejected with error satisfying', { response: { status: 400 } }))
      // Request url to upload icons
      .then(() => axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/icon`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'link');
        const link = res.data.link;
        // Upload icon
        const stats = fs.statSync(`${__dirname}/../icon.png`);
        return readFile(`${__dirname}/../icon.png`)
          .then(data => expect(axios({
            method: 'put',
            url: link,
            headers: { 'Content-Type': 'image/png', 'Content-Length': stats.size },
            data,
          }), 'to be fulfilled'));
      })
      // Wait few seconds if icon handling lambda has delay
      .then(() => wait.sleep(20000))
      // Approve should succeed
      .then(() => expect(axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/approve`,
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      // Manual approval
      .then(() => rds.queryAsync('UPDATE apps SET isApproved=1, isPublic=1 WHERE id=?', [appId1]))
      // Public app profile should exist now
      .then(() => expect(axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/apps/${vendor}/${appId1}`,
      }), 'to be fulfilled'))
      // List versions
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/versions`,
        headers: { Authorization: token },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data.length, 'to be positive');
      })
      // Get version
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId1}/versions/1`,
        headers: { Authorization: token },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'id');
      })
      // Public apps list should have at least one result
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/apps`,
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data.length, 'to be positive');
      }));

  const appName3 = `a3_${Date.now()}`;
  const appId3 = `${vendor}.${appName3}`;
  it('App With Permissions', () =>
    // Create app should fail on wrong permissions schema
    expect(axios({
      method: 'post',
      url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
      headers: { Authorization: token },
      responseType: 'json',
      data: {
        id: appName3,
        name: appName3,
        type: 'extractor',
        permissions: [
          {
            stack: 'stack',
            projects: 2,
          },
        ],
      },
    }), 'to be rejected with error satisfying', { response: { status: 422 } })
      .then(() => rds.queryAsync('DELETE FROM stacks WHERE name=?', ['stack']))
      // Create app should fail on non-existing stack
      .then(() => expect(axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          id: appName3,
          name: appName3,
          type: 'extractor',
          permissions: [
            {
              stack: 'stack',
              projects: [2],
            },
          ],
        },
      }), 'to be rejected with error satisfying', { response: { status: 422 } }))
      .then(() => rds.queryAsync('INSERT INTO stacks SET name=?', ['stack']))
      // List stacks
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/stacks`,
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.data, 'to contain', 'stack');
      })
      // Create app should succeed
      .then(() => expect(axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          id: appName3,
          name: appName3,
          type: 'extractor',
          permissions: [
            {
              stack: 'stack',
              projects: [2],
            },
          ],
        },
      }), 'to be fulfilled'))
      // Update app
      .then(() => expect(axios({
        method: 'patch',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId3}`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          permissions: [
            {
              stack: 'stack',
              projects: [2, 3],
            },
          ],
        },
      }), 'to be fulfilled'))
      // Get app detail
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId3}`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'id');
        expect(res.data.id, 'to be', appId3);
        expect(res.data, 'to have key', 'permissions');
        expect(res.data.permissions, 'to have length', 1);
        expect(res.data.permissions[0], 'to have key', 'stack');
        expect(res.data.permissions[0].stack, 'to be', 'stack');
        expect(res.data.permissions[0], 'to have key', 'projects');
        expect(res.data.permissions[0].projects, 'to equal', [2, 3]);
      })
      // Manual approval
      .then(() => rds.queryAsync('UPDATE apps SET isApproved=1 WHERE id=?', [appId3]))
      // Public app profile should not exist
      .then(() => expect(axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/apps/${vendor}/${appId3}`,
      }), 'to be rejected with error satisfying', { response: { status: 404 } }))
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/apps`,
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(_.map(res.data, app => app.id), 'not to contain', appId3);
      }));

  const appName4 = `a4_${Date.now()}`;
  const appId4 = `${vendor}.${appName4}`;
  const newAppName4 = `a44_${Date.now()}`;
  let prevVersion;
  it('App Version Rollback', () =>
    // Create app
    expect(axios({
      method: 'post',
      url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
      headers: { Authorization: token },
      responseType: 'json',
      data: {
        id: appName4,
        name: appName4,
        type: 'extractor',
      },
    }), 'to be fulfilled')
    // Update app
      .then(() => expect(axios({
        method: 'patch',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId4}`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          name: newAppName4,
        },
      }), 'to be fulfilled'))
      // Get app detail
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId4}`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'name');
        expect(res.data.name, 'to be', newAppName4);
        expect(res.data, 'to have key', 'version');
        prevVersion = res.data.version;
      })
      // Rollback
      .then(() => expect(axios({
        method: 'post',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId4}/versions/1/rollback`,
        headers: { Authorization: token },
        responseType: 'json',
      }), 'to be fulfilled'))
      // Get app detail
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId4}`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'name');
        expect(res.data.name, 'to be', appName4);
        expect(res.data, 'to have key', 'version');
        expect(res.data.version, 'to be', prevVersion + 1);
      }));

  let testApp1;
  let testApp2;
  it('Public Apps Listing', () =>
    rds.queryAsync(
      'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
      [`${vendor}.${appId1}List1`, vendor, 'test1'],
    )
      .then(() => rds.queryAsync(
        'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
        [`${vendor}.${appId1}List2`, vendor, 'test2'],
      ))
      // Public list all
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/apps`,
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data.length, 'to be greater than or equal to', 2);
        expect(res.data[0], 'to have key', 'name');
        testApp1 = res.data[0].name;
        expect(res.data[1], 'to have key', 'name');
        testApp2 = res.data[1].name;
      })
      // Public list limited
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/apps?offset=0&limit=1`,
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have length', 1);
        expect(res.data[0], 'to have key', 'name');
        expect(res.data[0].name, 'to be', testApp1);
      })
      // Public list limited
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/apps?offset=1&limit=1`,
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have length', 1);
        expect(res.data[0], 'to have key', 'name');
        expect(res.data[0].name, 'to be', testApp2);
      }));

  it('Vendor Apps Listing', () =>
    rds.queryAsync(
      'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
      [`${vendor}.${appId1}List3`, vendor, 'test1'],
    )
      .then(() => rds.queryAsync(
        'INSERT INTO `apps` SET id=?, vendor=?, name=?, isApproved=1',
        [`${vendor}.${appId1}List4`, vendor, 'test2'],
      ))
      // Vendor list all
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data.length, 'to be greater than or equal to', 2);
        expect(res.data[0], 'to have key', 'name');
        testApp1 = res.data[0].name;
        expect(res.data[1], 'to have key', 'name');
        testApp2 = res.data[1].name;
      })
      // Vendor list limited
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps?offset=0&limit=1`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have length', 1);
        expect(res.data[0], 'to have key', 'name');
        expect(res.data[0].name, 'to be', testApp1);
      })
      // Vendor list limited
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps?offset=1&limit=1`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have length', 1);
        expect(res.data[0], 'to have key', 'name');
        expect(res.data[0].name, 'to be', testApp2);
      }));

  const ecr = new aws.ECR({ region: env.REGION });
  const appName5 = `a3_${Date.now()}`;
  const appId5 = `${vendor}.${appName5}`;
  it('ECR', () =>
   // Create app
    axios({
      method: 'post',
      url: `${env.API_ENDPOINT}/vendors/${vendor}/apps`,
      headers: { Authorization: token },
      responseType: 'json',
      data: {
        id: appName5,
        name: appName5,
        type: 'extractor',
      },
    })
      .then((res) => {
        expect(res.status, 'to be', 201);
      })
      // Get repository credentials
      .then(() => axios({
        method: 'get',
        url: `${env.API_ENDPOINT}/vendors/${vendor}/apps/${appId5}/repository`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'registry');
        expect(res.data, 'to have key', 'repository');
        expect(res.data, 'to have key', 'credentials');
        expect(res.data.credentials, 'to have key', 'username');
        expect(res.data.credentials, 'to have key', 'password');
      })
      // Delete repository
      .then(() => ecr.deleteRepository({ force: true, repositoryName: `${env.SERVICE_NAME}/${appId5}` }).promise()));

  const s3 = new aws.S3();
  after(() =>
    rds.queryAsync('DELETE FROM apps WHERE vendor=?', [vendor])
    // Clear icons from s3
      .then(() => s3.listObjects({ Bucket: env.S3_BUCKET, Prefix: `${appId1}/` }).promise())
      .then((data) => {
        const promises = [];
        if (data && _.has(data, 'Contents')) {
          _.each(data.Contents, (file) => {
            promises.push(s3.deleteObject({ Bucket: env.S3_BUCKET, Key: file.Key }).promise());
          });
          return Promise.all(promises);
        }
      }));
});
