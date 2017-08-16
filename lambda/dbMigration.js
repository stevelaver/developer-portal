'use strict';

import Services from '../lib/Services';

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

  const listUsersAll = (paginationToken = null) => {
    const params = { UserPoolId: process.env.COGNITO_POOL_ID };
    if (paginationToken) {
      params.PaginationToken = paginationToken;
    }
    return services.getUserPool().getCognito().listUsers(params).promise()
      .then((data) => {
        const formattedData = _.map(data.Users, (item) => {
          const profile = _.find(item.Attributes, o => (o.Name === 'profile'));
          return {
            email: item.Username,
            name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', ''),
            vendors: profile ? _.get(profile, 'Value', '').split(',') : [],
            description: _.get(_.find(item.Attributes, o => (o.Name === 'custom:description')), 'Value', ''),
            createdOn: item.UserCreateDate,
          };
        });
        if (_.has(data, 'PaginationToken')) {
          return _.concat(formattedData, listUsersAll(data.PaginationToken));
        }
        return formattedData;
      });
  };

  let rds;
  return dbm.up()
    .catch((err) => {
      console.log('ERROR', err);
      return callback(err);
    })
    .then(() => {
      rds = mysql.createConnection(dbParams);
    })
    .then(() => listUsersAll())
    .then((res) => {
      const promises1 = [];
      _.each(res, (item) => {
        if (item.email) {
          promises1.push(rds.queryAsync('INSERT IGNORE INTO users SET ?', [{
            id: item.email,
            name: item.name,
            description: item.description ? item.description : null,
            serviceAccount: !_.includes(item.email, '@'),
            createdOn: item.createdOn,
          }]));
          _.each(item.vendors, (vendor) => {
            promises1.push(rds.queryAsync('INSERT IGNORE INTO vendors SET ?', [{
              id: vendor,
            }]));
            promises1.push(rds.queryAsync('INSERT IGNORE INTO usersToVendors SET ?', [{
              user: item.email,
              vendor,
            }]));
          });
        }
        return Promise.all(promises1);
      });
    })
    .then(() => rds.endAsync())
    .catch((err) => {
      rds.endAsync()
        .then(() => {
          throw err;
        });
    });
};
