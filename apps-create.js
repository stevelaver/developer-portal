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
    body: vandium.types.object().keys({
      id: vandium.types.string().min(3).max(50).regex(/^[a-zA-Z0-9-_]+$/).required()
        .error(new Error("Parameter id is required, must have between 3 and 50 characters and contain only letters, "
          + "numbers, dashes and underscores")),
      name: vandium.types.string().required().error(new Error("Parameter name is required")),
      type: vandium.types.string().valid('reader', 'application', 'writer').required()
        .error(new Error("Parameter type is required and must be one of: reader, writer, application")),
      imageUrl: vandium.types.string().uri().error(new Error("Parameter imageUrl must be url")),
      imageTag: vandium.types.string().error(new Error("Parameter imageTag must be string")),
      shortDescription: vandium.types.string().error(new Error("Parameter shortDescription must be string")),
      longDescription: vandium.types.string().error(new Error("Parameter longDescription must be string")),
      licenseUrl: vandium.types.string().uri().error(new Error("Parameter licenseUrl must be url")),
      documentationUrl: vandium.types.string().uri().error(new Error("Parameter documentationUrl must be url")),
      requiredMemory: vandium.types.string().error(new Error("Parameter requiredMemory must be string")),
      processTimeout: vandium.types.number().integer().min(1)
        .error(new Error("Parameter processTimeout must be integer bigger than one")),
      encryption: vandium.types.boolean().error(new Error("Parameter encryption must be boolean")),
      defaultBucket: vandium.types.boolean().error(new Error("Parameter defaultBucket must be boolean")),
      defaultBucketStage: vandium.types.string().valid('in', 'out')
        .error(new Error("Parameter defaultBucketStage must be one of: in, out")),
      forwardToken: vandium.types.boolean().error(new Error("Parameter forwardToken must be boolean")),
      uiOptions: vandium.types.array().error(new Error("Parameter uiOptions must be array")),
      testConfiguration: vandium.types.object(),
      configurationSchema: vandium.types.object(),
      networking: vandium.types.string().valid('dataIn', 'dataOut')
        .error(new Error("Parameter networking must be one of: dataIn, dataOut")),
      actions: vandium.types.array().error(new Error("Parameter actions must be array")),
      fees: vandium.types.boolean().error(new Error("Parameter fees must be boolean")),
      limits: vandium.types.string().error(new Error("Parameter limits must be string")),
      logger: vandium.types.string().valid('standard', 'gelf')
        .error(new Error("Parameter logger must be one of: standard, gelf"))
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
      identity.getUser(event.headers.Authorization, function (err, data) {
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
