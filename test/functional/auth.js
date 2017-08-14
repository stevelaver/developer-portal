'use strict';

import Services from '../Services';

require('longjohn');
const axios = require('axios');
const expect = require('unexpected');
const mysql = require('mysql');
const Promise = require('bluebird');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

const services = new Services(process.env);
const userPool = services.getUserPool();

const rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST,
  port: process.env.FUNC_RDS_PORT,
  user: process.env.FUNC_RDS_USER,
  password: process.env.FUNC_RDS_PASSWORD,
  database: process.env.FUNC_RDS_DATABASE,
  ssl: process.env.FUNC_RDS_SSL,
  multipleStatements: true,
});

const vendor = `v${Date.now()}`;
const userEmail = `u${Date.now()}@test.com`;
const userPassword1 = 'uiOU.-jfdksfj88';
const otherVendor = `${vendor}o1`;

describe('Auth', () => {
  before(() =>
    rds.queryAsync(
      'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
      [vendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
    )
      .then(() => rds.queryAsync(
        'INSERT IGNORE INTO `vendors` SET id=?, name=?, address=?, email=?, isPublic=?',
        [otherVendor, 'test', 'test', process.env.FUNC_USER_EMAIL, 0],
      )));

  it('Signup user', () =>
    // 1) Signup
    expect(axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/signup`,
      responseType: 'json',
      data: {
        email: userEmail,
        password: userPassword1,
        name: 'Test',
      },
    }), 'to be fulfilled')
      // 2) Login without confirmation
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: userEmail,
          password: userPassword1,
        },
      }), 'to be rejected'))
      // 3) Resend confirmation
      .then(() => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/confirm`,
        responseType: 'json',
        data: {
          email: userEmail,
          password: userPassword1,
        },
      }), 'to be fulfilled'))
      // 4) Confirm
      // We can't get valid code so we try with some invalid to check that
      // function works and confirm user manually
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/confirm/${process.env.FUNC_USER_EMAIL}/000`,
        responseType: 'json',
        data: {
          email: userEmail,
          password: userPassword1,
        },
      }))
      .catch((err) => {
        expect(err, 'to have key', 'response');
        expect(err.response, 'to have key', 'status');
        expect(err.response.status, 'to be', 404);
      })
      .then(() => userPool.confirmSignUp(userEmail))
      // 5) Login
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: userEmail,
          password: userPassword1,
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        return res.data.token;
      })
      // 6) Get Profile
      .then(token => axios({
        method: 'get',
        url: `${process.env.API_ENDPOINT}/auth/profile`,
        responseType: 'json',
        headers: { Authorization: token },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'vendors');
      }));

  it('Forgot password', () =>
    expect(axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/forgot/${process.env.FUNC_USER_EMAIL}`,
      responseType: 'json',
    }), 'to be fulfilled')
      // Check with fake code - as we can't get real one from email
      // so we just test if lambda function works
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/forgot/${process.env.FUNC_USER_EMAIL}/confirm`,
        responseType: 'json',
        data: {
          password: userPassword1,
          code: '000000',
        },
      }))
      .catch((err) => {
        expect(err, 'to have key', 'response');
        expect(err.response, 'to have key', 'status');
        expect(err.response.status, 'to be', 404);
      }));


  it('Refresh token and logout', () =>
    axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/login`,
      responseType: 'json',
      data: {
        email: process.env.FUNC_USER_EMAIL,
        password: process.env.FUNC_USER_PASSWORD,
      },
    })
      .then((loginData) => {
        expect(loginData.status, 'to be', 200);
        expect(loginData.data, 'to have key', 'refreshToken');
        return axios({
          method: 'get',
          url: `${process.env.API_ENDPOINT}/auth/token`,
          responseType: 'json',
          headers: { Authorization: loginData.data.refreshToken },
        })
          .then((res) => {
            expect(res.status, 'to be', 200);
            expect(res.data, 'to have key', 'token');
            return res.data.token;
          })
          .then(token => axios({
            method: 'get',
            url: `${process.env.API_ENDPOINT}/auth/profile`,
            responseType: 'json',
            headers: { Authorization: token },
          }))
          .then((res) => {
            expect(res.status, 'to be', 200);
            expect(res.data, 'to have key', 'name');
          })
          .then(() => axios({
            method: 'post',
            url: `${process.env.API_ENDPOINT}/auth/logout`,
            headers: { Authorization: loginData.data.accessToken },
          }))
          .then((res) => {
            expect(res.status, 'to be', 204);
          })
          .then(() => expect(axios({
            method: 'get',
            url: `${process.env.API_ENDPOINT}/auth/token`,
            responseType: 'json',
            headers: { Authorization: loginData.data.refreshToken },
          }), 'to be rejected'));
      }));

  it('MFA', () =>
    // 1) Signup
    expect(axios({
      method: 'post',
      url: `${process.env.API_ENDPOINT}/auth/signup`,
      responseType: 'json',
      data: {
        email: userEmail,
        password: userPassword1,
        name: 'Test',
      },
    }), 'to be fulfilled')
      .then(() => userPool.confirmSignUp(userEmail))
      // 2) Login
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: userEmail,
          password: userPassword1,
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'token');
        return res.data.token;
      })
      // 3) Enable MFA
      .then(token => expect(axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/mfa/${process.env.FUNC_USER_PHONE}`,
        responseType: 'json',
        headers: { Authorization: token },
      }), 'to be fulfilled'))
      .then(() => userPool.getUser(userEmail)
        .then((data) => {
          expect(data, 'to have key', 'phone');
          expect(data.phone, 'to be', process.env.FUNC_USER_PHONE);
        }))
      // 4) Login
      .then(() => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: userEmail,
          password: userPassword1,
        },
      }))
      .then((res) => {
        expect(res.status, 'to be', 200);
        expect(res.data, 'to have key', 'session');
        return res.data.session;
      })
      // 5) Login with MFA code
      .then(session => axios({
        method: 'post',
        url: `${process.env.API_ENDPOINT}/auth/login`,
        responseType: 'json',
        data: {
          email: userEmail,
          session,
          code: '000000',
        },
      }))
      .catch((err) => {
        expect(err, 'to have key', 'response');
        expect(err.response, 'to have key', 'status');
        expect(err.response.status, 'to be', 404);
      }));

  afterEach(() =>
    userPool.deleteUser(userEmail)
      .catch(() => {}));
});
