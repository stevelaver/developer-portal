'use strict';

import Log from '../lib/log';

const dbmLog = [];
console.log = () => {
  dbmLog.push([].slice.call(arguments));
};

require('longjohn');
require('babel-polyfill');
const dbMigrate = require('db-migrate');
const papertrail = require('winston-papertrail').Papertrail;
const winston = require('winston');
require('db-migrate-mysql');

const log = new Log(papertrail, winston);

exports.handler = function (event, context, callback) {
  const logger = log.get(process.env.LOG_HOST, process.env.LOG_PORT, process.env.SERVICE_NAME);
  const dbm = dbMigrate.getInstance(true, {
    config: {
      defaultEnv: 'current',
      current: {
        driver: 'mysql',
        user: process.env.RDS_USER,
        password: process.env.RDS_PASSWORD,
        host: process.env.RDS_HOST,
        database: process.env.RDS_DATABASE,
        port: process.env.RDS_PORT,
        ssl: 'Amazon RDS',
        multipleStatements: true,
      },
    },
  });

  return dbm.up()
    .then(() => {
      logger.info(JSON.stringify({ msg: 'Migration end', data: dbmLog }));
      logger.close();
      return callback(null, dbmLog);
    })
    .catch((err) => {
      console.log('ERROR', err);
      logger.info(JSON.stringify({ error: err, statusCode: 500 }));
      logger.close();
      return callback(err);
    });
};
