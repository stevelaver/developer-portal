'use strict';

const _ = require('lodash');

class Log {
  constructor(papertrail, winston) {
    this.papertrail = papertrail;
    this.winston = winston;
  }

  get(host, port, service) {
    const logger = new (this.winston.Logger)({
      transports: [],
    });

    logger.add(this.papertrail, {
      host,
      port,
      hostname: 'developer-portal',
      program: service,
      flushOnClose: true,
      includeMetaInMessage: false,
      handleExceptions: true,
      humanReadableUnhandledException: false,
      logFormat: (level, message) => {
        let logData;
        const consoleLog = message.split('\t');
        if (consoleLog.length === 3) {
          try {
            logData = JSON.parse(consoleLog[2]);
            if (_.has(logData.event, 'body') && _.isString(logData.event.body)) {
              logData.event.body = JSON.parse(logData.event.body);
            }
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
            if (_.has(logData.response, 'body.token')) {
              logData.response.body.token = '--omitted--';
            }
            return JSON.stringify(logData);
          } catch (e) {
            return consoleLog[2];
          }
        } else {
          try {
            logData = JSON.parse(message);
            if (!_.has(logData, 'statusCode')) {
              logData.statusCode = 500;
            }
          } catch (e) {
            logData = { message, statusCode: 500 };
          }
          return JSON.stringify(logData);
        }
      },
    });

    return logger;
  }
}

export default Log;
