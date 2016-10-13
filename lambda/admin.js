'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const log = require('../lib/log');
const vandium = require('vandium');


/**
 * Approve app
 */
module.exports.appApprove = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required')),
      }),
      path: vandium.types.object().keys({
        id: vandium.types.string().required(),
      }),
    },
  },
}).handler(function(event, context, callback) {
  log.start('adminAppApprove', event);
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function(user, cb) {
      db.getApp(event.path.id, null, function(err, data) {
        if (data.isApproved) {
          return cb(Error('[404] Already Approved'));
        }
        cb(err, user, data);
      });
    },
    function(user, app, cb) {
      db.updateApp({isApproved: 1}, event.path.id, user.email, function(err) {
        cb(err, app);
      });
    },
    function(app, cb) {
      db.getVendor(app.vendor, function(err, data) {
        cb(err, data, vendor);
      });
    },
    function(app, vendor, cb) {
      const ses = new aws.SES({apiVersion: '2010-12-01', region: env.REGION});
      ses.sendEmail({
        Source: env.SES_EMAIL_FROM,
        Destination: { ToAddresses: [vendor.email] },
        Message: {
          Subject: {
            Data: 'App approval in Keboola Developer Portal'
          },
          Body: {
            Text: {
              Data: 'Your app ' + app.id + ' has been approved'
            }
          }
        }
      }, function(err) {
        return cb(err);
      });
    }
  ], function(err, res) {
    db.end();
    return callback(err, res);
  });
});


/**
 * Apps List
 */
module.exports.apps = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required'))
      }),
      query: vandium.types.object().keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
        filter: vandium.types.string()
      })
    }
  }
}).handler(function(event, context, callback) {
  log.start('adminApps', event);
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
  async.waterfall([
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.listApps(event.query.filter, event.query.offset, event.query.limit, function(err, result) {
        db.end();
        return cb(err, result);
      });
    }
  ], callback);
});


/**
 * Make user admin
 */
module.exports.userAdmin = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required'))
      }),
      path: vandium.types.object().keys({
        email: vandium.types.email().error(Error('Parameter email must have format of email address'))
      })
    }
  }
}).handler(function(event, context, callback) {
  log.start('adminUserAdmin', event);
  const provider = new aws.CognitoIdentityServiceProvider({region: env.REGION});
  async.waterfall([
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function(user, cb) {
      provider.adminGetUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.path.email
      }, function(err, data) {
        if (err) {
          return cb(err);
        }

        const isAdmin = _.get(_.find(data.UserAttributes, function(o) { return o.Name == 'custom:isAdmin'; }), 'Value', null);
        if (isAdmin) {
          return cb(Error('[404] Already is admin'));
        }

        return cb(null, data);
      });
    },
    function(user, cb) {
      provider.adminUpdateUserAttributes({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.path.email,
        UserAttributes: [
          {
            Name: 'custom:isAdmin',
            Value: '1'
          }
        ]
      }, function(err) {
        return cb(err);
      });
    }
  ], callback);
});


/**
 * Enable user
 */
module.exports.userEnable = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required'))
      }),
      path: vandium.types.object().keys({
        email: vandium.types.email().error(Error('Parameter email must have format of email address'))
      })
    }
  }
}).handler(function(event, context, callback) {
  log.start('adminUserEnable', event);
  const provider = new aws.CognitoIdentityServiceProvider({region: env.REGION});
  async.waterfall([
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function(user, cb) {
      provider.adminGetUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.path.email
      }, function(err, data) {
        if (err) {
          return cb(err);
        }

        if (data.Enabled) {
          return cb(Error('[404] Already Enabled'));
        }

        return cb(null, data);
      });
    },
    function(user, cb) {
      provider.adminEnableUser({
        UserPoolId: env.COGNITO_POOL_ID,
        Username: event.path.email
      }, function(err) {
        return err ? cb(err) : cb(null, user);
      });
    },
    function(user, cb) {
      const vendor = _.get(_.find(user.UserAttributes, function(o) { return o.Name == 'profile'; }), 'Value', null);
      const ses = new aws.SES({apiVersion: '2010-12-01', region: env.REGION});
      ses.sendEmail({
        Source: env.SES_EMAIL_FROM,
        Destination: { ToAddresses: [event.path.email] },
        Message: {
          Subject: {
            Data: 'Welcome to Keboola Developer Portal'
          },
          Body: {
            Text: {
              Data: 'Your account in Keboola Developer Portal for vendor ' + vendor + ' has been approved'
            }
          }
        }
      }, function(err) {
        return cb(err);
      });
    }
  ], callback);
});


/**
 * Users List
 */
module.exports.users = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required'))
      }),
      query: vandium.types.object().keys({
        offset: vandium.types.number().integer().default(0).allow(''),
        limit: vandium.types.number().integer().default(100).allow(''),
        filter: vandium.types.string()
      })
    }
  }
}).handler(function(event, context, callback) {
  log.start('adminUsers', event);
  var filter = '';
  switch (event.query.filter) {
    case 'enabled':
      filter = 'status = "Enabled"';
      break;
    case 'disabled':
      filter = 'status = "Disabled"';
      break;
    case 'unconfirmed':
      filter = 'cognito:user_status = "Unconfirmed"';
      break;
    case 'confirmed':
      filter = 'cognito:user_status = "Confirmed"';
      break;
  }
  const provider = new aws.CognitoIdentityServiceProvider({ region: env.REGION });
  async.waterfall([
    function (cb) {
      identity.getAdmin(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      provider.listUsers({
        UserPoolId: env.COGNITO_POOL_ID,
        Filter: filter,
      }, cb);
    },
    function(data, cb) {
      cb(null, _.map(data.Users, function(item) {
        return {
          email: item.Username,
          name: _.get(_.find(item.Attributes, function(o) {
            return o.Name == 'name';
          }), 'Value', null),
          vendor: _.get(_.find(item.Attributes, function(o) {
            return o.Name == 'profile';
          }), 'Value', null),
          createdOn: item.UserCreateDate,
          isEnabled: item.Enabled,
          status: item.UserStatus,
          id: _.get(_.find(item.Attributes, function(o) {
            return o.Name == 'sub';
          }), 'Value', null),
        };
      }));
    }
  ], callback);
});
