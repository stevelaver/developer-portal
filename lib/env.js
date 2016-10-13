'use strict';

const _ = require('lodash');
const yaml = require('yamljs');

var env = module.exports;

env.load = function () {
  let res = {};
  _.each(yaml.load(__dirname + '/../env.yml'), (value, key) => {
    res[key] = value;
  });
  return res;
};
