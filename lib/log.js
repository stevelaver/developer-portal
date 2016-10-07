'use strict';
const _ = require('lodash');
const papertrail = require('winston-papertrail').Papertrail;
const winston = require('winston');
require('dotenv').config({silent: true});

var log = module.exports;

log.init = function() {
  winston.add(papertrail, {
    handleExceptions: true,
    humanReadableUnhandledException: true,
    host: process.env.LOG_HOST,
    port: process.env.LOG_PORT,
    hostname: 'jakub-dev-portal',
    program: '$version',
    flushOnClose: true,
    logFormat: function (level, message) {
      console.log('ERR', {lvl: level, msg: message});
    }
  });
};

log.start = function(func, event) {
  //log.init();

  var e = _.cloneDeep(event);
  if (_.has(e, 'headers.Authorization')) {
    e.headers.Authorization = '--omitted--';
  }
  if (_.has(e, 'body.repository.options.password')) {
    e.body.repository.options.password = '--omitted--';
  }
  if (_.has(e, 'body.repository.options.#password')) {
    e.body.repository.options['#password'] = '--omitted--';
  }
  if (_.has(e, 'body.password')) {
    e.body.password = '--omitted--';
  }
  console.log(JSON.stringify({message: 'start', function: func, event: e}));
};
