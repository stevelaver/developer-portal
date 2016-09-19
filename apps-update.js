'use strict';
require('dotenv').config();

var async = require('async');
var db = require('lib/db');
var identity = require('lib/identity');
const vandium = require('vandium');

module.exports.handler = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    }),
    path: {
      appId: vandium.types.string().required()
    },
    body: vandium.types.object().keys({
      name: vandium.types.string().error(Error('Parameter name must be string')),
      type: vandium.types.string().valid('reader', 'application', 'writer')
        .error(Error('Parameter type must be one of: reader, writer, application')),
      imageUrl: vandium.types.string().uri().error(Error('Parameter imageUrl must be url')),
      imageTag: vandium.types.string().error(Error('Parameter imageTag must be string')),
      shortDescription: vandium.types.string().error(Error('Parameter shortDescription must be string')),
      longDescription: vandium.types.string().error(Error('Parameter longDescription must be string')),
      licenseUrl: vandium.types.string().uri().error(Error('Parameter licenseUrl must be url')),
      documentationUrl: vandium.types.string().uri().error(Error('Parameter documentationUrl must be url')),
      requiredMemory: vandium.types.string().error(Error('Parameter requiredMemory must be string')),
      processTimeout: vandium.types.number().integer().min(1)
        .error(Error('Parameter processTimeout must be integer bigger than one')),
      encryption: vandium.types.boolean().error(Error('Parameter encryption must be boolean')),
      defaultBucket: vandium.types.boolean().error(Error('Parameter defaultBucket must be boolean')),
      defaultBucketStage: vandium.types.string().valid('in', 'out')
        .error(Error('Parameter defaultBucketStage must be one of: in, out')),
      forwardToken: vandium.types.boolean().error(Error('Parameter forwardToken must be boolean')),
      uiOptions: vandium.types.array().error(Error('Parameter uiOptions must be array')),
      testConfiguration: vandium.types.object(),
      configurationSchema: vandium.types.object(),
      networking: vandium.types.string().valid('dataIn', 'dataOut')
        .error(Error('Parameter networking must be one of: dataIn, dataOut')),
      actions: vandium.types.array().error(Error('Parameter actions must be array')),
      fees: vandium.types.boolean().error(Error('Parameter fees must be boolean')),
      limits: vandium.types.string().error(Error('Parameter limits must be string')),
      logger: vandium.types.string().valid('standard', 'gelf')
        .error(Error('Parameter logger must be one of: standard, gelf'))
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
      identity.getUser(event.headers.Authorization, callbackLocal);
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
