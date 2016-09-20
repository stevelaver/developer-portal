'use strict';
var async = require('async');
var aws = require('aws-sdk');
var db = require('lib/db');
var identity = require('lib/identity');
var vandium = require('vandium');
require('dotenv').config({silent: true});

/**
 * Approve
 */
module.exports.handler = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    }),
    path: vandium.types.object().keys({
      appId: vandium.types.string().required().error(Error('[422] Parameter appId is required'))
    })
  }
}).handler(function(event, context, callback) {
  db.connect({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    ssl: process.env.RDS_SSL
  });
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(process.env.REGION, event.headers.Authorization, callbackLocal);
    },
    function (user, callbackLocal) {
      db.checkAppAccess(event.path.appId, user.vendor, function(err) {
        return callbackLocal(err);
      });
    },
    function(callbackLocal) {
      db.getApp(event.path.appId, null, function(err, data) {
        if (err) {
          return callbackLocal(err);
        }

        if (data.isApproved) {
          return callbackLocal(Error('[400] Already approved'));
        }
        return callbackLocal(err, data);
      });
    },
    function(app, callbackLocal) {
      var required = ['imageUrl', 'imageTag', 'shortDescription', 'longDescription', 'licenseUrl', 'documentationUrl'];
      var empty = [];
      required.forEach(function(item) {
        if (!app[item]) {
          empty.push(item);
        }
      });
      if (empty.length) {
        return callbackLocal(Error('[400] App properties ' + empty.join(', ') + ' cannot be empty'));
      }
      if (!app.icon32) {
        return callbackLocal(Error('[400] App icon of size 32px is missing, upload it first.'));
      }
      if (!app.icon64) {
        return callbackLocal(Error('[400] App icon of size 64px is missing, upload it first.'));
      }
      return callbackLocal(null, app);
    }
  ], function(err, app) {
    if (err) {
      db.end();
      return callback(err);
    }

    var ses = new aws.SES({apiVersion: '2010-12-01', region: process.env.REGION});
    ses.sendEmail({
      Source: process.env.SES_EMAIL,
      Destination: { ToAddresses: [process.env.SES_EMAIL] },
      Message: {
        Subject: {
          Data: '[dev-portal] Request for approval of app ' + app.id
        },
        Body: {
          Text: {
            Data: JSON.stringify(app, null, 4)
          }
        }
      }
    }, function(errLocal) {
      db.end();
      return callback(errLocal);
    });
  });
});
