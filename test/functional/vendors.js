'use strict';

import Services from '../services';

require('longjohn');
const _ = require('lodash');
const axios = require('axios');
const expect = require('unexpected');
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
const userPool = services.getUserPool();

const userEmail = `func-vendors1-${Date.now()}@keboola.com`;
const vendor = process.env.FUNC_VENDOR;
const vendor1 = `T.vendor.${Date.now()}`;
let token;

describe('Vendors', () => {
  before(() =>
    userPool.updateUserAttribute(process.env.FUNC_USER_EMAIL, 'profile', vendor)
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: process.env.FUNC_USER_EMAIL,
          password: process.env.FUNC_USER_PASSWORD,
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        token = res.data.token;
      })
      .then(() => db.init(rds))
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        [vendor1, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
      ))
      .then(() => services.getUserPoolWithDatabase(db))
      .then(userPoolDb => userPoolDb.listUsersForVendor(vendor))
      .then((data) => {
        _.each(data.users, (user) => {
          if (user.email !== process.env.FUNC_USER_EMAIL) {
            userPool.deleteUser(user.email);
          }
        });
      }));

  const vendorName = `vendor.${Date.now()}`;
  const vendorId2 = `vendor2.${Date.now()}`;
  it('Create vendor', () =>
    axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/login`,
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
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/vendors`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          name: vendorName,
          address: 'test',
          email: 'test@test.com',
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 201);
        expect(res.data, 'to have key', 'id');
        expect(res.data, 'to have key', 'name');
        expect(res.data, 'to have key', 'address');
        expect(res.data, 'to have key', 'email');
      })
      // Check database
      .then(() => rds.queryAsync('SELECT * FROM `vendors` WHERE name=?', [vendorName]))
      .then((res) => {
        expect(res, 'to have length', 1);
        expect(res[0].id, 'to begin with', '_v');
        expect(res[0].isApproved, 'to be', 0);
        return res[0].id;
      })
      .then(vendorId => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/admin/vendors/${vendorId}/approve`,
        responseType: 'json',
        headers: { Authorization: token },
        data: {
          newId: vendorId2,
        },
      }), 'to be fulfilled')
        .then(() => userPool.getUser(process.env.FUNC_USER_EMAIL)
          .then((user) => {
            expect(user, 'to have key', 'vendors');
            expect(user.vendors, 'to contain', vendorId2);
          })
        )));

  it('Update vendor', () =>
    rds.queryAsync('UPDATE `vendors` SET address=? WHERE id=?', ['address', vendor1])
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: process.env.FUNC_USER_EMAIL,
          password: process.env.FUNC_USER_PASSWORD,
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        token = res.data.token;
      })
      .then(() => axios({
        method: 'patch',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor1}`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          address: `address ${vendor1}`,
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'id');
        expect(res.data, 'to have key', 'name');
        expect(res.data, 'to have key', 'address');
        expect(res.data, 'to have key', 'email');
        token = res.data.token;
      })
      .then(() => rds.queryAsync('SELECT * FROM `vendors` WHERE id=?', [vendor1]))
      .then((res) => {
        expect(res, 'to have length', 1);
        expect(res[0].address, 'to be', `address ${vendor1}`);
      }));

  it('Join and remove from vendor', () =>
    axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/login`,
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
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor1}/users`,
        headers: { Authorization: token },
        responseType: 'json',
      }), 'to be fulfilled'))
      .then(() => userPool.getUser(process.env.FUNC_USER_EMAIL))
      .then((user) => {
        expect(user, 'to have key', 'vendors');
        expect(user.vendors, 'to contain', vendor1);
      })
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: process.env.FUNC_USER_EMAIL,
          password: process.env.FUNC_USER_PASSWORD,
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        token = res.data.token;
      })
      // Remove from vendor
      .then(() => expect(axios({
        method: 'delete',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor1}/users/${process.env.FUNC_USER_EMAIL}`,
        headers: { Authorization: token },
        responseType: 'json',
      }), 'to be fulfilled'))
      .then(() => userPool.getUser(process.env.FUNC_USER_EMAIL))
      .then((user) => {
        expect(user, 'to have key', 'vendors');
        expect(user.vendors, 'not to contain', vendor1);
      }));

  const userEmail2 = `func-vendors2-${Date.now()}@keboola.com`;
  it('Request and accept joining vendor', () =>
    expect(axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/signup`,
      responseType: 'json',
      data: {
        email: userEmail2,
        password: 'uiOU.-jfdksfj88',
        name: 'Test',
      },
    }), 'to be fulfilled')
      .then(() => userPool.confirmSignUp(userEmail2))
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: userEmail2,
          password: 'uiOU.-jfdksfj88',
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        token = res.data.token;
      })
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor1}/users`,
        headers: { Authorization: token },
        responseType: 'json',
      }), 'to be fulfilled'))
      .then(() => userPool.getUser(userEmail2))
      .then((user) => {
        expect(user, 'to have key', 'vendors');
        expect(user.vendors, 'not to contain', vendor1);
      })
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: process.env.FUNC_USER_EMAIL,
          password: process.env.FUNC_USER_PASSWORD,
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        token = res.data.token;
      })
      // List requests
      .then(() => axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor1}/user-requests`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have an item satisfying', { username: userEmail2 });
      })
      // Accept the request
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor1}/users/${userEmail2}`,
        headers: { Authorization: token },
        responseType: 'json',
      }), 'to be fulfilled'))
      .then(() => userPool.getUser(userEmail2))
      .then((user) => {
        expect(user, 'to have key', 'vendors');
        expect(user.vendors, 'to contain', vendor1);
      })
      // List requests
      .then(() => axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor1}/user-requests`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have length', 0);
      })
      .then(() => userPool.deleteUser(userEmail2)));

  it('Invite user', () =>
    // 1) Signup
    expect(axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/signup`,
      responseType: 'json',
      data: {
        email: userEmail,
        password: 'uiOU.-jfdksfj88',
        name: 'Test',
      },
    }), 'to be fulfilled')
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: process.env.FUNC_USER_EMAIL,
          password: process.env.FUNC_USER_PASSWORD,
        },
      }))
    // 2) Invite
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor}/invitations/${userEmail}`,
        headers: { Authorization: token },
        responseType: 'json',
      }), 'to be fulfilled'))
      // 3) Check existence in db and get code
      .then(() => rds.queryAsync('SELECT * FROM `invitations` WHERE vendor=? AND email=?', [vendor, userEmail]))
      .then((res) => {
        expect(res, 'to have length', 1);
        return res[0].code;
      })
      // 4) Accept invitation
      .then(code => expect(axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor}/invitations/${userEmail}/${code}`,
      }), 'to be fulfilled'))
      // 5) Check vendor in cognito
      .then(() => userPool.getUser(userEmail))
      .then((user) => {
        expect(user, 'to have key', 'vendors');
        expect(user.vendors, 'to contain', vendor);
      }));

  it('Create service user, list and delete', () =>
    axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/login`,
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
      .then(() => userPool.deleteUser(`${vendor}+test`))
      .catch(() => null)
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor}/credentials`,
        headers: { Authorization: token },
        responseType: 'json',
        data: {
          name: 'test',
          description: 'Test desc',
        },
      }), 'to be fulfilled'))
      .then(() => axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/vendors/${vendor}/users?service=1`,
        headers: { Authorization: token },
        responseType: 'json',
      }))
      .then(res => expect(res.data, 'to have an item satisfying', { username: `${vendor}+test` }))
  );

  after(() =>
    rds.queryAsync('DELETE FROM `invitations` WHERE vendor=? AND email=?', [vendor, userEmail])
  );
});
