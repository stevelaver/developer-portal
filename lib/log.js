'use strict';

const _ = require('lodash');
const papertrail = require('winston-papertrail').Papertrail;
const winston = require('winston');

const log = module.exports;
let logger;

log.init = (host, port, service) => {
  logger = new (winston.Logger)({
    transports: [],
  });

  logger.add(papertrail, {
    host,
    port,
    hostname: 'developer-portal',
    program: service,
    flushOnClose: true,
    includeMetaInMessage: false,
    handleExceptions: true,
    humanReadableUnhandledException: false,
    logFormat: (level, message) => {
      const consoleLog = /(.*)\t(.*)\t(.*)/g.exec(message);
      if (consoleLog) {
        const logData = JSON.parse(consoleLog[3]);
        if (_.has(logData.event, 'headers.Authorization')) {
          logData.event.headers.Authorization = '--omitted--';
        }
        if (_.has(logData.event, 'body.repository.options.password')) {
          logData.event.body.repository.options.password = '--omitted--';
        }
        if (_.has(logData.event, 'body.repository.options.#password')) {
          logData.event.body.repository.options['#password'] = '--omitted--';
        }
        if (_.has(logData.event, 'body.password')) {
          logData.event.body.password = '--omitted--';
        }
        /* if (_.has(logData, 'message') || _.has(logData, 'event')) {
          data = logData;
        } else {
          data.log = JSON.parse(consoleLog[3]);
          if (_.has(data.log, 'errorMessage')) {
            level = 'error';
            message = data.log.errorMessage;
          }
        }
        data.request = consoleLog[2];*/
        return JSON.stringify(logData);
      }

      return JSON.stringify({ message: JSON.parse(message), level });
    },
  });

  return logger;
};
