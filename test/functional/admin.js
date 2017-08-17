'use strict';

import Services from '../Services';

require('longjohn');
const axios = require('axios');
const expect = require('unexpected');
const moment = require('moment');
const mysql = require('mysql');
const Promise = require('bluebird');
const db = require('../../lib/db');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

const services = new Services(process.env);

const rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST,
  port: process.env.FUNC_RDS_PORT,
  user: process.env.FUNC_RDS_USER,
  password: process.env.FUNC_RDS_PASSWORD,
  database: process.env.FUNC_RDS_DATABASE,
  ssl: process.env.FUNC_RDS_SSL,
  multipleStatements: true,
});
let userPool;

const vendor = process.env.FUNC_VENDOR;
const otherVendor = `${vendor}o1`;
const appId = `app_admin_${Date.now()}`;
const userEmail = `u${Date.now()}.test@keboola.com`;
let token;

describe('Admin', () => {
  before(() =>
    expect(axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/login`,
      responseType: 'json',
      data: {
        email: process.env.FUNC_USER_EMAIL,
        password: process.env.FUNC_USER_PASSWORD,
      },
    }), 'to be fulfilled')
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        token = res.data.token;
      })
      .then(() => db.init(rds))
      .then(() => {
        userPool = services.getUserPool();
      })
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
      ))
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        [otherVendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
      ))
      .then(() => rds.queryAsync('DELETE FROM apps WHERE vendor=?', [vendor]))
      .then(() => services.getUserPoolWithDatabase(db))
      .then(userPoolDb => userPoolDb.signUp(userEmail, '123jfsklJFKLAD._.d-X', 'Test')
        .then(() => userPoolDb.addUserToVendor(userEmail, 'test'))
        .then(() => userPool.confirmSignUp(userEmail))));

  const appId2 = `${otherVendor}.${appId}-2`;
  it('Create and Edit App', () =>
    rds.queryAsync(
      'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
      [otherVendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
    )
      // Create
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/vendors/${otherVendor}/apps`,
        responseType: 'json',
        headers: { Authorization: token },
        data: {
          id: `${appId}-2`,
          name: 'test',
          type: 'extractor',
        },
      }), 'to be fulfilled'))
      // Get app detail
      .then(() => expect(axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/admin/apps/${appId2}`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'forwardToken');
        expect(res.data.forwardToken, 'to be false');
      })
      // Update app
      .then(() => expect(axios({
        method: 'patch',
        url: `${process.env.API_ENDPOINT}/admin/apps/${appId2}`,
        responseType: 'json',
        headers: { Authorization: token },
        data: {
          forwardToken: true,
        },
      }), 'to be fulfilled'))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'id');
        expect(res.data, 'to have key', 'forwardToken');
        expect(res.data.forwardToken, 'to be true');
      })
      // Get app detail
      .then(() => expect(axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/admin/apps/${appId2}`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'forwardToken');
        expect(res.data.forwardToken, 'to be true');
      })
      // Get apps changes
      .then(() => expect(axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/admin/changes?since=${moment().subtract(5, 'minutes').format('YYYY-MM-DD')}`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data.length, 'to be greater than or equal to', 2);
        expect(res.data, 'to have an item satisfying', (item) => {
          expect(item.id, 'to be', appId2);
        });
      }));

  it('Approve App', () =>
    rds.queryAsync(
      'INSERT INTO `apps` SET id=?, vendor=?, name=?, isPublic=?',
      [appId, vendor, 'test', 0],
    )
      // Get app detail
      .then(() => expect(axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/admin/apps/${appId}`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'isPublic');
        expect(res.data.isPublic, 'to be', false);
      })
      // Update app
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/admin/apps/${appId}/approve`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      // Get app detail
      .then(() => expect(axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/admin/apps/${appId}`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'isPublic');
        expect(res.data.isPublic, 'to be', true);
      }));

  const userEmail2 = `test-func-admin-u2${Date.now()}.test@keboola.com`;
  it('Delete User', () =>
    services.getUserPoolWithDatabase(db)
      .then(userPool2 => userPool2.signUp(userEmail2, '123jfsklJFKLAD._.d-X', 'Test'))
      .then(() => expect(axios({
        method: 'delete',
        url: `${process.env.API_ENDPOINT}/admin/users/${userEmail2}`,
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then(() => expect(() => userPool.getUser(userEmail2), 'to error'))
  );

  it('Make User Admin', () =>
    userPool.getUser(userEmail)
      .then((data) => {
        expect(data.isAdmin, 'to be false');
      })
      // Make user admin
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/admin/users/${userEmail}/admin`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then(() => userPool.getUser(userEmail))
      .then((data) => {
        expect(data.isAdmin, 'to be true');
      }));

  it('Add User to a Vendor', () =>
    userPool.getUser(userEmail)
      .then((user) => {
        expect(user, 'to have key', 'vendors');
        expect(user.vendors, 'not to contain', otherVendor);
      })
      // Add vendor
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/admin/users/${userEmail}/vendors/${otherVendor}`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then((res) => {
        expect(res.status, 'to be', 204);
      })
      .then(() => userPool.getUser(userEmail))
      .then((user) => {
        expect(user, 'to have key', 'vendors');
        expect(user.vendors, 'to contain', otherVendor);
      })
      // Remove vendor
      .then(() => expect(axios({
        method: 'delete',
        url: `${process.env.API_ENDPOINT}/admin/users/${userEmail}/vendors/${otherVendor}`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then((res) => {
        expect(res.status, 'to be', 204);
      })
      .then(() => userPool.getUser(userEmail))
      .then((user) => {
        expect(user, 'to have key', 'vendors');
        expect(user.vendors, 'not to contain', otherVendor);
      }));

  const vendor2 = `av2${Date.now()}`;
  it('Create vendor', () =>
    axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/admin/vendors`,
      responseType: 'json',
      headers: { Authorization: token },
      data: {
        id: vendor2,
        name: vendor2,
        address: 'test',
        email: process.env.FUNC_USER_EMAIL,
      },
    })
      .then((res) => {
        expect(res.status, 'to be', 201);
      })
      .then(() => axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor2}`,
        responseType: 'json',
        headers: { Authorization: token },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'name');
        expect(res.data.name, 'to be', vendor2);
      })
      .then(() => axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/vendors`,
        responseType: 'json',
        headers: { Authorization: token },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have an item satisfying', { id: vendor2 });
      })
      .then(() => rds.queryAsync('DELETE FROM apps WHERE vendor=?', [vendor2])));

  const vendor3 = `av3${Date.now()}`;
  it('Approve vendor', () =>
    rds.queryAsync(
      'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?, isApproved=?',
      [vendor3, 'test', 'test', process.env.FUNC_USER_EMAIL, 0, 0],
    )
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/admin/vendors/${vendor3}/approve`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then(() => rds.queryAsync('SELECT * FROM `vendors` WHERE id=?', [vendor3]))
      .then((data) => {
        expect(data, 'to have length', 1);
        expect(data[0], 'to have key', 'id');
        expect(data[0], 'to have key', 'isApproved');
        expect(data[0].isApproved, 'to be', 1);
      })
      .then(() => rds.queryAsync('DELETE FROM apps WHERE vendor=?', [vendor3])));

  const vendor4 = `av4${Date.now()}`;
  const vendor5 = `av5${Date.now()}`;
  it('Approve vendor with new id', () =>
    rds.queryAsync(
      'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?, isApproved=?, createdBy=?',
      [vendor4, 'test', 'test', process.env.FUNC_USER_EMAIL, 0, 0, userEmail],
    )
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/admin/vendors/${vendor4}/approve`,
        responseType: 'json',
        headers: { Authorization: token },
        data: {
          newId: vendor5,
        },
      }), 'to be fulfilled'))
      .then(() => rds.queryAsync('SELECT * FROM `vendors` WHERE id=?', [vendor4]))
      .then((data) => {
        expect(data, 'to have length', 0);
      })
      .then(() => rds.queryAsync('SELECT * FROM `vendors` WHERE id=?', [vendor5]))
      .then((data) => {
        expect(data, 'to have length', 1);
        expect(data[0], 'to have key', 'id');
        expect(data[0], 'to have key', 'isApproved');
        expect(data[0].isApproved, 'to be', 1);
      })
      .then(() => rds.queryAsync('DELETE FROM apps WHERE vendor=?', [vendor3]))
      .then(() => userPool.getUser(userEmail))
      .then((data) => {
        expect(data.vendors, 'not to contain', vendor4);
        expect(data.vendors, 'to contain', vendor5);
      })
      .then(() => rds.queryAsync('DELETE FROM apps WHERE vendor=?', [vendor5])));

  after(() =>
    rds.queryAsync('DELETE FROM apps WHERE vendor=? OR vendor=?', [vendor, otherVendor])
      .then(() => userPool.deleteUser(userEmail)));
});
