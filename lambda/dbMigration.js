'use strict';

require('longjohn');
require('babel-polyfill');
require('source-map-support').install();
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');

exports.handler = function (event, context, callback) {
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
    .catch((err) => {
      console.log('ERROR', err);
      return callback(err);
    });
};
