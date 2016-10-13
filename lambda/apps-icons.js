'use strict';

if (!global._babelPolyfill) {
  require('babel-polyfill');
}

const async = require('async');
const aws = require('aws-sdk');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const log = require('../lib/log');
const moment = require('moment');
const vandium = require('vandium');

module.exports.links = vandium.createInstance({
  validation: {
    schema: {
      headers: vandium.types.object().keys({
        Authorization: vandium.types.string().required().error(Error('[422] Authorization header is required'))
      }),
      path: vandium.types.object().keys({
        appId: vandium.types.string().required()
      })
    }
  }
}).handler(function(event, context, callback) {
  log.start('appsIcons', event);
  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL
  });
  async.waterfall([
    function (callbackLocal) {
      identity.getUser(env.REGION, event.headers.Authorization, callbackLocal);
    },
    function (user, callbackLocal) {
      db.checkAppAccess(event.path.appId, user.vendor, function(err) {
        return callbackLocal(err);
      });
    },
    function(callbackLocal) {
      const s3 = new aws.S3();
      const validity = 3600;
      const expires = moment().add(validity, 's').utc().format();
      async.parallel({
        32: function (callbackLocal2) {
          s3.getSignedUrl(
            'putObject',
            {
              Bucket: env.S3_BUCKET_ICONS,
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
              Bucket: env.S3_BUCKET_ICONS,
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

  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const appId = key.split('/').shift();
  const size = key.split('/')[1];

  db.connect({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL
  });
  const s3 = new aws.S3();
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
