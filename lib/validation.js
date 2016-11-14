'use strict';

const _ = require('lodash');
const error = require('./error');
const joi = require('joi');

const validation = module.exports;

validation.validate = function (eventIn, schema) {
  const event = _.clone(eventIn);
  if (_.has(event, 'body') && _.isString(event.body)) {
    event.body = JSON.parse(event.body);
  }
  const res = joi.validate(
    event,
    validation.schema(schema),
    { allowUnknown: true }
  );

  if (res.error) {
    throw error.unprocessable(res.error.message);
  }
  return true;
};

validation.schema = function (def) {
  let body = {};
  const headers = {};
  let path = {};
  let query = {};

  if (_.has(def, 'auth')) {
    headers.Authorization = joi.string().required()
      .error(Error('Header Authorization is required'));
  }

  if (_.has(def, 'query')) {
    query = _.merge(query, def.query);
  }

  if (_.has(def, 'body')) {
    body = _.merge(body, def.body);
  }

  if (_.has(def, 'pagination')) {
    query.offset = joi.number().integer().default(0).min(0)
      .allow('')
      .error(Error('Parameter offset must be integer greater then 0'));
    query.limit = joi.number().integer().default(100)
      .min(1)
      .max(100)
      .allow('')
      .error(Error('Parameter limit must be integer from 1 to 100'));
  }

  if (_.has(def, 'path')) {
    path = _.merge(path, def.path);
  }

  const res = {};
  if (_.size(body)) {
    res.body = joi.object().allow(null).keys(body);
  }
  if (_.size(headers)) {
    res.headers = joi.object().allow(null).keys(headers);
  }
  if (_.size(path)) {
    res.pathParameters = joi.object().allow(null).keys(path);
  }
  if (_.size(query)) {
    res.queryStringParameters = joi.object().allow(null).keys(query);
  }

  return res;
};
