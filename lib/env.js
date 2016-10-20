'use strict';

const _ = require('lodash');
const fs = require('fs');
const yaml = require('yamljs');

const env = module.exports;

env.load = function () {
  let res = {};
  if (fs.existsSync(`${__dirname}/../env.yml`)) {
    _.each(yaml.load(`${__dirname}/../env.yml`), (value, key) => {
      res[key] = value;
    });
  } else {
    res = process.env;
  }

  return res;
};
