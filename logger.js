var _ = require('lodash');
var zlib = require('zlib');
var winston = require('winston');
var papertrailTransport = require('winston-papertrail').Papertrail;
require('dotenv').config({silent: true});

exports.handler = function (event, context, callback) {
  var payload = new Buffer(event.awslogs.data, 'base64');

  zlib.gunzip(payload, function (err, result) {
    if (err) {
      return callback(err);
    }

    var log = new (winston.Logger)({
      transports: []
    });

    log.add(papertrailTransport, {
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
            var res = _.split(val, ': ');
            data.report[res[0]] = res[1];
          });
          message = 'END';
          data.request = data.report.RequestId;
          delete data.report.RequestId;
        } else {
          var consoleLog = /(.*)\t(.*)\t(.*)/g.exec(message);
          if (consoleLog) {
            var logData = JSON.parse(consoleLog[3]);
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

    var data = JSON.parse(result.toString('utf8'));

    data.logEvents.forEach(function(line) {
      if (!_.startsWith(line.message, 'END RequestId') && !_.startsWith(line.message, 'START RequestId')) {
        log.info(line.message);
      }
    });

    log.close();
    callback();
  });
};