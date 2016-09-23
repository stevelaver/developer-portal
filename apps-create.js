'use strict';
var async = require('async');
var db = require('lib/db');
var identity = require('lib/identity');
var vandium = require('vandium');
require('dotenv').config({silent: true});

module.exports.handler = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    }),
    body: vandium.types.object().keys({
      id: vandium.types.string().min(3).max(50).regex(/^[a-zA-Z0-9-_]+$/).required()
        .error(Error("[422] Parameter id is required, must have between 3 and 50 characters and contain only letters, "
          + "numbers, dashes and underscores")),
      name: vandium.types.string().required().error(Error("[422] Parameter name is required")),
      type: vandium.types.string().valid('reader', 'application', 'writer').required()
        .error(Error("[422] Parameter type is required and must be one of: reader, writer, application")),
      repository: vandium.types.object().keys({
        type: vandium.types.string().valid('dockerhub', 'quay').error(Error("[422] Parameter repository.type must be one of: dockerhub, quay")),
        username: vandium.types.string().error(Error("[422] Parameter repository.username must be string")),
        password: vandium.types.string().error(Error("[422] Parameter repository.password must be string")),
        uri: vandium.types.string().error(Error("[422] Parameter repository.uri must be uri")),
        tag: vandium.types.string().error(Error("[422] Parameter repository.tag must be string")),
      }),
      shortDescription: vandium.types.string().error(Error("[422] Parameter shortDescription must be string")),
      longDescription: vandium.types.string().error(Error("[422] Parameter longDescription must be string")),
      licenseUrl: vandium.types.string().uri().error(Error("[422] Parameter licenseUrl must be url")),
      documentationUrl: vandium.types.string().uri().error(Error("[422] Parameter documentationUrl must be url")),
      requiredMemory: vandium.types.string().error(Error("[422] Parameter requiredMemory must be string")),
      processTimeout: vandium.types.number().integer().min(1)
        .error(Error("[422] Parameter processTimeout must be integer bigger than one")),
      encryption: vandium.types.boolean().error(Error("[422] Parameter encryption must be boolean")),
      defaultBucket: vandium.types.boolean().error(Error("[422] Parameter defaultBucket must be boolean")),
      defaultBucketStage: vandium.types.string().valid('in', 'out')
        .error(Error("[422] Parameter defaultBucketStage must be one of: in, out")),
      forwardToken: vandium.types.boolean().error(Error("[422] Parameter forwardToken must be boolean")),
      uiOptions: vandium.types.array().error(Error("[422] Parameter uiOptions must be array")),
      testConfiguration: vandium.types.object(),
      configurationSchema: vandium.types.object(),
      configurationDescription: vandium.types.string(),
      emptyConfiguration: vandium.types.object(),
      actions: vandium.types.array().error(Error("[422] Parameter actions must be array")),
      fees: vandium.types.boolean().error(Error("[422] Parameter fees must be boolean")),
      limits: vandium.types.string().error(Error("[422] Parameter limits must be string")),
      logger: vandium.types.string().valid('standard', 'gelf')
        .error(Error("[422] Parameter logger must be one of: standard, gelf")),
      loggerConfiguration: vandium.types.object()
    })
  }
}).handler(function(event, context, callback) {
  var params = event.body;

  db.connect({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    ssl: process.env.RDS_SSL
  });
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(process.env.REGION, event.headers.Authorization, function (err, data) {
        if (err) return callbackLocal(err);
        params.createdBy = data.email;
        return callbackLocal(null, data);
      });
    },
    function (user, callbackLocal) {
      params.vendor = user.vendor;
      params.id = user.vendor + '.' + params.id;

      db.checkAppNotExists(params.id, function (err) {
        return callbackLocal(err);
      });
    },
    function (callbackLocal) {
      db.insertApp(params, function (err) {
        return callbackLocal(err);
      });
    }
  ], function (err) {
    db.end();
    return callback(err);
  });
});
