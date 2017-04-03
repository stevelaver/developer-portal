'use strict';

const _ = require('lodash');
const error = require('./error');
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
    event: {
      requestId: context.awsRequestId,
      function: context.functionName,
      path: event.path,
      httpMethod: event.httpMethod,
    },
    error: null,
    response: {
      statusCode: (response && 'statusCode' in response) ? response.statusCode : null,
    },
  };
  if (err) {
    log.error = {
      name: err.name,
      message: err.message,
    };
    if ('stack' in err) {
      log.error.stack = err.stack.split('\n');
    }
    if ('fileName' in err) {
      log.error.fileName = err.fileName;
    }
    if ('lineNumber' in err) {
      log.error.lineNumber = err.lineNumber;
    }
  }
  return log;
};

request.errorHandler = function (fn, event, context, cb) {
  try {
    fn();
  } catch (err) {
    let res;
    if (err instanceof UserError) {
      res = request.getResponseBody(err, null, event, context);
      if (_.isObject(res.body)) {
        res.body = JSON.stringify(res.body);
      }
    } else {
      res = {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(formatAppError(context)),
      };
    }
    console.log(JSON.stringify(formatLog(context, err, event, res)));
    cb(null, res);
  }
};

request.htmlErrorHandler = function (fn, event, context, cb) {
  try {
    fn();
  } catch (err) {
    let res;

    if (err instanceof UserError) {
      res = {
        statusCode: _.isNumber(err.code) ? err.code : 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html.error(err.message, context.awsRequestId),
      };
    } else {
      res = {
        statusCode: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html.error('Application error', context.awsRequestId),
      };
    }
    console.log(JSON.stringify(formatLog(context, err, event, res)));
    cb(null, res);
  }
};

request.getResponseBody = function (err, res, event, context, code = 200) {
  const response = {
    statusCode: code,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: null,
  };
  if (err) {
    if (err instanceof UserError) {
      response.statusCode = _.isNumber(err.code) ? err.code : 400;
      response.body = {// JSON.stringify({
        errorMessage: err.message,
        errorType: err.type,
        requestId: context.awsRequestId,
      };// });
    } else {
      response.statusCode = 500;
      response.body = formatAppError(context);// JSON.stringify(formatAppError(context));
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
  /* if (response.body && _.isObject(response.body)) {
    response.body = JSON.stringify(response.body);
  }*/
  cb(null, response);
};

request.htmlResponse = function (err, res, event, context, cb, code = 200) {
  const response = request.getResponseBody(err, res, event, context, code);

  console.log(JSON.stringify(formatLog(context, err, event, response)));

  if (response.body && 'errorMessage' in response.body) {
    response.body = html.error(response.body.errorMessage, context.awsRequestId);
  } else {
    response.body = html.page(response.body.header, response.body.content);
  }
  response.headers = { 'Content-Type': 'text/html; charset=utf-8' };
  cb(null, response);
};

request.responsePromise = function (promise, event, context, callback, code = 200) {
  return promise
  .then(res =>
    request.response(null, res, event, context, callback, code)
  )
  .catch(err =>
    request.response(err, null, event, context, callback)
  );
};

request.responseDbPromise = function (promise, db, event, context, callback, code = 200) {
  return promise
  .then(res =>
    db.end()
      .then(() => request.response(null, res, event, context, callback, code))
  )
  .catch(err =>
    db.end()
      .then(() => request.response(err, null, event, context, callback))
  );
};

request.responseAuthPromise = function (promise, event, context, callback, code = 200) {
  return promise
  .then(res =>
    request.response(null, res, event, context, callback, code)
  )
  .catch((err) => {
    if (err.code === 'ServiceUnavailableException') {
      return request.response(error.unavailable(err), null, event, context, callback);
    }
    return request.response(error.authError(err), null, event, context, callback);
  });
};
