'use strict';

const _ = require('lodash');
const papertrail = require('winston-papertrail').Papertrail;
const winston = require('winston');

const log = module.exports;
let logger;

log.init = (host, port, service) => {
  logger = new (winston.Logger) ({
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
    humanReadableUnhandledException: true,
    logFormat: (level, message) => {
      let data = {};
      if (_.startsWith(message, 'REPORT ')) {
        data.report = {};
        _.each(_.split(message.substr(7), '\t'), (val) => {
          const res = _.split(val, ': ');
          data.report[res[0]] = res[1];
        });
        message = 'END';
        data.request = data.report.RequestId;
        delete data.report.RequestId;
      } else {
        const consoleLog = /(.*)\t(.*)\t(.*)/g.exec(message);
        if (consoleLog) {
          const logData = JSON.parse(consoleLog[3]);
          if (_.has(logData, 'message')) {
            data = logData;
          } else {
            data.log = JSON.parse(consoleLog[3]);
            if (_.has(data.log, 'errorMessage')) {
              level = 'error';
              message = data.log.errorMessage;
            }
          }
          data.request = consoleLog[2];
        }
      }
      return JSON.stringify(_.assign({ message, level }, data));
    },
  });
};

log.start = function (func, event) {
  //log.init();

  const e = _.cloneDeep(event);
  if (_.has(e, 'headers.Authorization')) {
    e.headers.Authorization = '--omitted--';
  }
  if (_.has(e, 'body.repository.options.password')) {
    e.body.repository.options.password = '--omitted--';
  }
  if (_.has(e, 'body.repository.options.#password')) {
    e.body.repository.options['#password'] = '--omitted--';
  }
  if (_.has(e, 'body.password')) {
    e.body.password = '--omitted--';
  }
  console.log(JSON.stringify({ message: 'start', function: func, event: e }));
};
