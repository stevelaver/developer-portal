'use strict';

const _ = require('lodash');
const UserError = require('../lib/UserError');

const request = module.exports;

request.errorHandler = function (fn, context, cb) {
  try {
    fn();
  } catch (err) {
    const log = {
      requestId: context.awsRequestId,
      function: context.functionName,
      error: {
        name: err.name,
        message: err.message,
      },
      response: {
        statusCode: 500,
        body: {
          error: 'Application error',
          requestId: context.awsRequestId,
        },
      },
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
    console.log(JSON.stringify(log));

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

  console.log(JSON.stringify({
    requestId: context.awsRequestId,
    function: context.functionName,
    error: err,
    event,
    response,
  }));

  response.body = response.body ? JSON.stringify(response.body) : '';
  cb(null, response);
};
