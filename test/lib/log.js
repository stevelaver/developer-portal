'use strict';

import Log from '../../lib/Log';

const expect = require('unexpected');
const papertrail = require('winston-papertrail').Papertrail;
const winston = require('winston');

require('dotenv').config({ path: '.env-test', silent: true });

describe('log', () => {
  it('init logger', () => {
    const log = new Log(papertrail, winston);
    const logger = log.get('logs.papertrailapp.com', 1111, 'test');
    expect(logger, 'to have key', 'transports');
    expect(logger.transports, 'to have key', 'Papertrail');
  });
});
