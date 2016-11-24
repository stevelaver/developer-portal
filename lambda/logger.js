'use strict';

require('babel-polyfill');
const _ = require('lodash');
const log = require('../lib/log');
const zlib = require('zlib');

exports.handler = function (event, context, callback) {
  const payload = new Buffer(event.awslogs.data, 'base64');

  zlib.gunzip(payload, (err, result) => {
    if (err) {
      return callback(err);
    }

    const logger = log.init(process.env.LOG_HOST, process.env.LOG_PORT, process.env.SERVICE_NAME);
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
