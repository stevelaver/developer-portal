'use strict';

import Log from '../lib/Log';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');
const papertrail = require('winston-papertrail').Papertrail;
const winston = require('winston');
const zlib = require('zlib');

const log = new Log(papertrail, winston);

exports.handler = function (event, context, callback) {
  const payload = new Buffer(event.awslogs.data, 'base64');

  zlib.gunzip(payload, (err, result) => {
    if (err) {
      return callback(err);
    }

    const logger = log.get(process.env.LOG_HOST, process.env.LOG_PORT, process.env.SERVICE_NAME);
    const data = JSON.parse(result.toString('utf8'));

    data.logEvents.forEach((line) => {
      if (!_.startsWith(line.message, 'END RequestId') &&
        !_.startsWith(line.message, 'START RequestId') &&
        !_.startsWith(line.message, 'REPORT RequestId')) {
        logger.info(line.message);
      }
    });

    logger.close();
    return callback();
  });
};
