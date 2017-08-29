'use strict';

import Services from '../lib/services';

require('longjohn');
require('source-map-support').install();
const dbMigrate = require('db-migrate');
require('db-migrate-mysql');
const _ = require('lodash');
const mysql = require('mysql');
const Promise = require('bluebird');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

const services = new Services(process.env);
const dbParams = {
  driver: 'mysql',
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  host: process.env.RDS_HOST,
  database: process.env.RDS_DATABASE,
  port: process.env.RDS_PORT,
  ssl: process.env.RDS_SSL,
  multipleStatements: true,
};

exports.handler = function (event, context, callback) {
  const dbm = dbMigrate.getInstance(true, {
    config: {
      defaultEnv: 'current',
      current: dbParams,
    },
  });

  let rds;
  const promises = [];

  const listUsersAll = (paginationToken = null) => {
    const params = { UserPoolId: process.env.COGNITO_POOL_ID };
    if (paginationToken) {
      params.PaginationToken = paginationToken;
    }
    return services.getUserPool().getCognito().listUsers(params).promise()
      .then((data) => {
        _.each(data.Users, (user) => {
          const vendorsObject = _.find(user.Attributes, o => (o.Name === 'profile'));
          const vendors = vendorsObject ? _.get(vendorsObject, 'Value', '').split(',') : [];
          promises.push(rds.queryAsync('INSERT IGNORE INTO users SET ?', [{
            id: user.Username,
            name: _.get(_.find(user.Attributes, o => (o.Name === 'name')), 'Value', ''),
            description: _.get(_.find(user.Attributes, o => (o.Name === 'custom:description')), 'Value', null),
            serviceAccount: !_.includes(user.Username, '@'),
            createdOn: user.UserCreateDate,
          }]));
          _.each(vendors, (vendor) => {
            promises.push(rds.queryAsync('INSERT IGNORE INTO vendors SET ?', [{
              id: vendor,
            }]));
            promises.push(rds.queryAsync('INSERT IGNORE INTO usersToVendors SET ?', [{
              user: user.Username,
              vendor,
            }]));
          });
        });

        if (_.has(data, 'PaginationToken')) {
          listUsersAll(data.PaginationToken);
        }
      });
  };

  return dbm.up()
    .catch((err) => {
      console.log('ERROR', err);
      return callback(err);
    })
    .then(() => {
      rds = mysql.createConnection(dbParams);
    })
    .then(() => listUsersAll())
    .then(() => Promise.all(promises))
    .then(() => rds.endAsync())
    .catch((err) => {
      rds.endAsync()
        .then(() => {
          throw err;
        });
    });
};
