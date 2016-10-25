'use strict';

const UserError = require('../lib/UserError');

const error = module.exports;

error.badRequest = function (msg = 'Bad Request') {
  const err = new UserError(msg);
  err.code = 400;
  err.type = 'BadRequest';
  return err;
};

error.forbidden = function (msg = 'Forbidden') {
  const err = new UserError(msg);
  err.code = 403;
  err.type = 'Forbidden';
  return err;
};

error.notFound = function (msg = 'Not Found') {
  const err = new UserError(msg);
  err.code = 404;
  err.type = 'NotFound';
  return err;
};

error.authError = function (err) {
  if (!err) {
    return null;
  }
  let newErr = new UserError(err.message);
  newErr.type = err.code;
  switch (err.code) {
    case 'UserNotFoundException':
      newErr.message = 'User not found.';
      newErr.code = 404;
      break;
    case 'ExpiredCodeException':
    case 'CodeMismatchException':
      newErr.code = 404;
      break;
    case 'LimitExceededException':
      newErr.code = 400;
      break;
    case 'NotAuthorizedException':
    case 'UserNotConfirmedException':
      newErr.code = 401;
      break;
    default:
      newErr = err;
  }
  return newErr;
};
