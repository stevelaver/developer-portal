'use strict';

require('babel-polyfill');
const _ = require('lodash');
const env = require('../env.yml');
const log = require('../lib/log');
const zlib = require('zlib');

exports.handler = function (event, context, callback) {
  const payload = new Buffer(event.awslogs.data, 'base64');

  zlib.gunzip(payload, (err, result) => {
    if (err) {
      return callback(err);
    }

    log.init(env.LOG_HOST, env.LOG_PORT, env.SERVICE_NAME);
    const data = JSON.parse(result.toString('utf8'));

    data.logEvents.forEach((line) => {
      if (!_.startsWith(line.message, 'END RequestId') && !_.startsWith(line.message, 'START RequestId')) {
        log.logger.info(line.message);
      }
    });

    log.logger.close();
    return callback();
  });
};
