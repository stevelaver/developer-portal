'use strict';

const UserError = require('../lib/UserError');

const error = module.exports;

error.badRequest = (msg = 'Bad Request') => {
  const err = new UserError(msg);
  err.code = 400;
  err.type = 'BadRequest';
  return err;
};

error.unauthorized = (msg = 'Unauthorized') => {
  const err = new UserError(msg);
  err.code = 401;
  err.type = 'Unauthorized';
  return err;
};

error.forbidden = (msg = 'Forbidden') => {
  const err = new UserError(msg);
  err.code = 403;
  err.type = 'Forbidden';
  return err;
};

error.notFound = (msg = 'Not Found') => {
  const err = new UserError(msg);
  err.code = 404;
  err.type = 'NotFound';
  return err;
};

error.unprocessable = (msg = 'Unprocessable Entity') => {
  const err = new UserError(msg);
  err.code = 422;
  err.type = 'UnprocessableEntity';
  return err;
};

error.unavailable = (msg = 'AWS Cognito is currently unavailable, try again later please') => {
  const err = new UserError(msg);
  err.code = 503;
  err.type = 'ServiceUnavailable';
  return err;
};


error.authError = (err) => {
  if (!err) {
    return null;
  }
  let newErr = new UserError(err.message);
  newErr.type = err.code;
  switch (err.code) {
    case 'UsernameExistsException':
      newErr.code = 400;
      break;
    case 'UserNotFoundException':
      newErr.message = 'User not found.';
      newErr.code = 404;
      break;
    case 'ExpiredCodeException':
    case 'CodeMismatchException':
      newErr.code = 404;
      break;
    case 'LimitExceededException':
      newErr.code = 429;
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
