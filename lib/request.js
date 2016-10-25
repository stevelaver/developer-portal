'use strict';

const _ = require('lodash');
const UserError = require('../lib/UserError');

const request = module.exports;

const formatLog = function (context, err, event = null, res = null) {
  const response = _.clone(res);
  const log = {
    requestId: context.awsRequestId,
    function: context.functionName,
    error: null,
    event,
    response,
  };
  if (!err && log.response.body) {
    log.response.body = `${JSON.stringify(log.response.body).substr(0, 60)}..`;
  }
  if (err) {
    log.error = {
      name: err.name,
      message: err.message,
    };
    if (_.has(err, 'stack')) {
      log.error.stack = err.stack.split('\n');
    }
    if (_.has(err, 'fileName')) {
      log.error.fileName = err.fileName;
    }
    if (_.has(err, 'lineNumber')) {
      log.error.lineNumber = err.lineNumber;
    }
    if (!log.response) {
      log.response = {
        statusCode: 500,
        body: {
          error: 'Application error',
          requestId: context.awsRequestId,
        },
      };
    }
  }
  return log;
};

request.errorHandler = function (fn, context, cb) {
  try {
    fn();
  } catch (err) {
    console.log(JSON.stringify(formatLog(context, err)));

    cb(null, {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Application error',
        requestId: context.awsRequestId,
      }),
    });
  }
};

request.response = function (err, res, event, context, cb, code = 200) {
  const response = {
    statusCode: code,
    body: null,
  };
  if (err) {
    if (err instanceof UserError) {
      response.statusCode = _.isNumber(err.code) ? err.code : 400;
      response.body = {
        error: err.message,
        errorType: err.type,
        requestId: context.awsRequestId,
      };
    } else {
      response.statusCode = 500;
      response.body = {
        error: 'Application error',
        requestId: context.awsRequestId,
      };
    }
  } else {
    response.body = res;
  }

  console.log(JSON.stringify(formatLog(context, err, event, response)));

  response.body = response.body ? JSON.stringify(response.body) : '';
  cb(null, response);
};
