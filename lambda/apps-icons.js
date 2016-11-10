'use strict';

require('babel-polyfill');
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const joi = require('joi');
const moment = require('moment');
const request = require('../lib/request');
const validation = require('../lib/validation');

module.exports.links = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, validation.schema({
    auth: true,
    path: {
      appId: joi.string().required(),
    },
  }));
  db.connectEnv(env);
  async.waterfall([
    function (cb) {
      identity.getUser(env.REGION, event.headers.Authorization, cb);
    },
    function (user, cb) {
      db.checkAppAccess(event.pathParameters.appId, user.vendor, err => cb(err));
    },
    function (cb) {
      const s3 = new aws.S3();
      const validity = 3600;
      const expires = moment().add(validity, 's').utc().format();
      async.parallel({
        32: (cb2) => {
          s3.getSignedUrl(
            'putObject',
            {
              Bucket: env.S3_BUCKET,
              Key: `${event.pathParameters.appId}/32/latest.png`,
              Expires: validity,
              ContentType: 'image/png',
              ACL: 'public-read',
            },
            cb2
          );
        },
        64: (cb2) => {
          s3.getSignedUrl(
            'putObject',
            {
              Bucket: env.S3_BUCKET,
              Key: `${event.pathParameters.appId}/64/latest.png`,
              Expires: validity,
              ContentType: 'image/png',
              ACL: 'public-read',
            },
            cb2
          );
        },
      }, (err, data) => {
        const res = data;
        if (err) {
          return cb(err);
        }
        res.expires = expires;
        return cb(null, res);
      });
    },
  ], (err, res) => {
    db.end();
    return request.response(err, res, event, context, callback);
  });
}, event, context, callback);


module.exports.upload = (event, context, callback) => request.errorHandler(() => {
  if (!_.has(event, 'Records') || !event.Records.length ||
    !_.has(event.Records[0], 's3') || !_.has(event.Records[0].s3, 'bucket') ||
    !_.has(event.Records[0].s3, 'object') ||
    !_.has(event.Records[0].s3.bucket, 'name') ||
    !_.has(event.Records[0].s3.object, 'key')) {
    throw Error(`Event is missing. See: ${JSON.stringify(event)}`);
  }

  if (event.Records[0].eventName !== 'ObjectCreated:Put') {
    return callback();
  }

  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const appId = key.split('/').shift();
  const size = key.split('/')[1];

  db.connectEnv(env);
  const s3 = new aws.S3();
  async.waterfall([
    function (cb) {
      db.addAppIcon(appId, size, (err, version) => cb(null, version));
    },
    function (version, cb) {
      s3.copyObject(
        {
          CopySource: `${bucket}/${key}`,
          Bucket: bucket,
          Key: `${appId}/${size}/${version}.png`,
          ACL: 'public-read',
        },
        (err) => {
          cb(err);
        }
      );
    },
  ], (err, result) => {
    db.end();
    return callback(err, result);
  });
}, event, context, callback);
