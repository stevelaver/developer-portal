const _ = require('lodash');
const papertrail = require('winston-papertrail').Papertrail;
const winston = require('winston');
const zlib = require('zlib');
require('dotenv').config({ silent: true });

exports.handler = function (event, context, callback) {
  const payload = new Buffer(event.awslogs.data, 'base64');

  zlib.gunzip(payload, function (err, result) {
    const log = new (winston.Logger)({
      transports: [],
    });

    if (err) {
      return callback(err);
    }

    log.add(papertrail, {
      host: process.env.LOG_HOST,
      port: process.env.LOG_PORT,
      hostname: context.functionName,
      program: context.functionVersion,
      flushOnClose: true,
      includeMetaInMessage: false,
      handleExceptions: true,
      logFormat: function (level, message) {
        var data = {};
        if (_.startsWith(message, 'REPORT ')) {
          data.report = {};
          _.each(_.split(message.substr(7), "\t"), function(val) {
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
        return JSON.stringify(_.assign({
          message: message,
          level: level
        }, data));
      }
    });

    const data = JSON.parse(result.toString('utf8'));

    data.logEvents.forEach(function(line) {
      if (!_.startsWith(line.message, 'END RequestId') && !_.startsWith(line.message, 'START RequestId')) {
        log.info(line.message);
      }
    });

    log.close();
    callback();
  });
};
