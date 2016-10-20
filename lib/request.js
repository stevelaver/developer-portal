'use strict';

const _ = require('lodash');
const UserError = require('../lib/UserError');

const request = module.exports;

request.errorHandler = function (fn, context, cb) {
  try {
    fn();
  } catch (err) {
    console.log(JSON.stringify(err));

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
  let statusCode = code;
  let body;
  if (err) {
    if (err instanceof UserError) {
      statusCode = _.isNumber(err.code) ? err.code : 400;
      body = {
        error: err.message,
        errorType: err.type,
        requestId: context.awsRequestId,
      };
    } else {
      statusCode = 500;
      body = {
        error: 'Application error',
        requestId: context.awsRequestId,
      };
    }
  } else {
    body = res;
  }

  console.log(JSON.stringify({
    requestId: context.awsRequestId,
    function: context.functionName,
    error: err,
    event,
    response: {
      statusCode,
      body,
    },
  }));
  cb(null, { statusCode, body: JSON.stringify(body) });
};
