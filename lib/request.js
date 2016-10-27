'use strict';

const _ = require('lodash');
const html = require('./html');
const UserError = require('./UserError');

const request = module.exports;

const formatAppError = function (context) {
  return {
    errorMessage: 'Application error',
    errorType: 'ApplicationError',
    requestId: context.awsRequestId,
  };
};

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
        body: formatAppError(context),
      };
    }
  }
  return log;
};

request.errorHandler = function (fn, context, cb) {
  try {
    fn();
  } catch (err) {
    if (err instanceof UserError) {
      cb(null, request.getResponseBody(err, null, null, context));
    } else {
      console.log(JSON.stringify(formatLog(context, err)));
      cb(null, {
        statusCode: 500,
        body: JSON.stringify(formatAppError(context)),
      });
    }
  }
};

request.htmlErrorHandler = function (fn, context, cb) {
  try {
    fn();
  } catch (err) {
    console.log(JSON.stringify(formatLog(context, err)));

    cb(null, {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: html.error('Application error', context.awsRequestId),
    });
  }
};

request.getResponseBody = function (err, res, event, context, code = 200) {
  const response = {
    statusCode: code,
    body: null,
  };
  if (err) {
    if (err instanceof UserError) {
      response.statusCode = _.isNumber(err.code) ? err.code : 400;
      response.body = {
        errorMessage: err.message,
        errorType: err.type,
        requestId: context.awsRequestId,
      };
    } else {
      response.statusCode = 500;
      response.body = formatAppError(context);
    }
  } else {
    response.body = res;
  }

  return response;
};

request.response = function (err, res, event, context, cb, code = 200) {
  const response = request.getResponseBody(err, res, event, context, code);

  console.log(JSON.stringify(formatLog(context, err, event, response)));

  response.body = response.body ? JSON.stringify(response.body) : '';
  cb(null, response);
};

request.htmlResponse = function (err, res, event, context, cb, code = 200) {
  const response = request.getResponseBody(err, res, event, context, code);

  console.log(JSON.stringify(formatLog(context, err, event, response)));

  if (_.has(response.body, 'error')) {
    response.body = html.error(response.body.error, context.awsRequestId);
  } else {
    response.body = html.page(response.body.header, response.body.content);
  }
  response.headers = { 'Content-Type': 'text/html' };
  cb(null, response);
};
