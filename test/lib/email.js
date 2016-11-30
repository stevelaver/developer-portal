'use strict';

import Email from '../../lib/email';

require('dotenv').config({ path: '.env-test', silent: true });
const Promise = require('bluebird');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
const awsMock = require('aws-sdk-mock');
const aws = require('aws-sdk');

const expect = chai.expect;
chai.use(dirtyChai);

describe('email', () => {
  it('send email', () => {
    const ses = new aws.SES({ apiVersion: '2010-12-01', region: 'eu-west-1' });
    awsMock.mock('SES', 'sendEmail', (params, cb) => {
      console.log('MOCK', params);
      cb(null, 'ok');
    });
    const email = new Email(ses, 'from@email.com');
    return email.send('to@email.com', 'subject', 'header', 'content')
    .then(() => {
      console.log('THEN');
    })
    .catch((err) => {
      console.log('ERR', err);
      chai.assert.fail(err.message);
    });
  });
});
