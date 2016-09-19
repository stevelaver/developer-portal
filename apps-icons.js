'use strict';
require('dotenv').config();

var async = require('async');
var aws = require('aws-sdk');
var db = require('lib/db');
var identity = require('lib/identity');
var moment = require('moment');
const vandium = require('vandium');

module.exports.links = vandium.createInstance({
  validation: {
    headers: vandium.types.object().keys({
      authorizationToken: vandium.types.string().required()
    }),
    path: {
      appId: vandium.types.string().required()
    }
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
        return callbackLocal(err);
      });
    },
    function(callbackLocal) {
      var s3 = new aws.S3();
      var validity = 3600;
      var expires = moment().add(validity, 's').utc().format();
      async.parallel({
        32: function (callbackLocal2) {
          s3.getSignedUrl(
            'putObject',
            {
              Bucket: process.env.S3_BUCKET_ICONS,
              Key: event.path.appId + '/32/latest.png',
              Expires: validity,
              ContentType: 'image/png',
              ACL: 'public-read'
            },
            callbackLocal2
          );
        },
        64: function (callbackLocal2) {
          s3.getSignedUrl(
            'putObject',
            {
              Bucket: process.env.S3_BUCKET_ICONS,
              Key: event.path.appId + '/64/latest.png',
              Expires: validity,
              ContentType: 'image/png',
              ACL: 'public-read'
            },
            callbackLocal2
          );
        }
      }, function(err, data) {
        if (err) {
          return callbackLocal(err);
        }
        data.expires = expires;
        return callbackLocal(null, data);
      });
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});


module.exports.upload = vandium.createInstance().handler(function(event, context, callback) {
  if (!event.hasOwnProperty('Records') || !event.Records.length || !event.Records[0].hasOwnProperty('s3')  ||
    !event.Records[0].s3.hasOwnProperty('bucket') || !event.Records[0].s3.hasOwnProperty('object') ||
    !event.Records[0].s3.bucket.hasOwnProperty('name') || !event.Records[0].s3.object.hasOwnProperty('key')) {
    throw Error('Event is missing. See: ' + JSON.stringify(event));
  }

  if (event.Records[0].eventName !== 'ObjectCreated:Put') {
    return callback();
  }

  var bucket = event.Records[0].s3.bucket.name;
  var key = event.Records[0].s3.object.key;
  var appId = key.split('/').shift();
  var size = key.split('/')[1];

  db.connect({
    host: process.env.RDS_HOST,
    user: process.env.RDS_USER,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE,
    ssl: process.env.RDS_SSL
  });
  var s3 = new aws.S3();
  async.waterfall([
    function(callbackLocal) {
      db.addAppIcon(appId, size, function(err, version) {
        return callbackLocal(null, version);
      });
    },
    function(version, callbackLocal) {
      s3.copyObject(
        {
          CopySource: bucket + '/' + key,
          Bucket: bucket,
          Key: appId + '/' + size + '/' + version + '.png',
          ACL: 'public-read'
        },
        function(err) {
          callbackLocal(err);
        }
      );
    }
  ], function(err, result) {
    db.end();
    return callback(err, result);
  });
});
