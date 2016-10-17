'use strict';

const _ = require('lodash');
const yaml = require('yamljs');

const env = module.exports;

env.load = function () {
  const res = {};
  _.each(yaml.load(`${__dirname}/../env.yml`), (value, key) => {
    res[key] = value;
  });
  return res;
};
