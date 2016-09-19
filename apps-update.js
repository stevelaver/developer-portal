'use strict';
var async = require('async');
var db = require('lib/db');
var identity = require('lib/identity');
const vandium = require('vandium');

require('dotenv').config();

module.exports.handler = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    }),
    path: {
      appId: vandium.types.string().required()
    },
    body: vandium.types.object().keys({
      name: vandium.types.string().error(Error('[422] Parameter name must be string')),
      type: vandium.types.string().valid('reader', 'application', 'writer')
        .error(Error('[422] Parameter type must be one of: reader, writer, application')),
      imageUrl: vandium.types.string().uri().error(Error('[422] Parameter imageUrl must be url')),
      imageTag: vandium.types.string().error(Error('[422] Parameter imageTag must be string')),
      shortDescription: vandium.types.string().error(Error('[422] Parameter shortDescription must be string')),
      longDescription: vandium.types.string().error(Error('[422] Parameter longDescription must be string')),
      licenseUrl: vandium.types.string().uri().error(Error('[422] Parameter licenseUrl must be url')),
      documentationUrl: vandium.types.string().uri().error(Error('[422] Parameter documentationUrl must be url')),
      requiredMemory: vandium.types.string().error(Error('[422] Parameter requiredMemory must be string')),
      processTimeout: vandium.types.number().integer().min(1)
        .error(Error('[422] Parameter processTimeout must be integer bigger than one')),
      encryption: vandium.types.boolean().error(Error('[422] Parameter encryption must be boolean')),
      defaultBucket: vandium.types.boolean().error(Error('[422] Parameter defaultBucket must be boolean')),
      defaultBucketStage: vandium.types.string().valid('in', 'out')
        .error(Error('[422] Parameter defaultBucketStage must be one of: in, out')),
      forwardToken: vandium.types.boolean().error(Error('[422] Parameter forwardToken must be boolean')),
      uiOptions: vandium.types.array().error(Error('[422] Parameter uiOptions must be array')),
      testConfiguration: vandium.types.object(),
      configurationSchema: vandium.types.object(),
      networking: vandium.types.string().valid('dataIn', 'dataOut')
        .error(Error('[422] Parameter networking must be one of: dataIn, dataOut')),
      actions: vandium.types.array().error(Error('[422] Parameter actions must be array')),
      fees: vandium.types.boolean().error(Error('[422] Parameter fees must be boolean')),
      limits: vandium.types.string().error(Error('[422] Parameter limits must be string')),
      logger: vandium.types.string().valid('standard', 'gelf')
        .error(Error('[422] Parameter logger must be one of: standard, gelf'))
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
        return callbackLocal(err, user);
      });
    },
    function(user, callbackLocal) {
      db.updateApp(event.body, event.path.appId, user.email, callbackLocal);
    }
  ], function(err) {
    db.end();
    return callback(err);
  });
});
