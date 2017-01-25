'use strict';

import Log from '../../lib/log';

const papertrail = require('winston-papertrail').Papertrail;
const winston = require('winston');

require('dotenv').config({ path: '.env-test', silent: true });

const chai = require('chai');
const dirtyChai = require('dirty-chai');

const expect = chai.expect;
chai.use(dirtyChai);

describe('log', () => {
  it('init logger', () => {
    const log = new Log(papertrail, winston);
    const logger = log.get('logs.papertrailapp.com', 1111, 'test');
    expect(logger).to.have.property('log');
    expect(logger).to.have.property('transports');
    expect(logger.transports).to.have.property('Papertrail');
  });
});
