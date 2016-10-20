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
