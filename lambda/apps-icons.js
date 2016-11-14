'use strict';

require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const db = require('../lib/db');
const env = require('../env.yml');
const identity = require('../lib/identity');
const joi = require('joi');
const moment = require('moment');
const Promise = require('bluebird');
const request = require('../lib/request');
const validation = require('../lib/validation');

const dbCallback = (err, res, callback) => {
  if (db) {
    try {
      db.end();
    } catch (err2) {
      // Ignore
    }
  }
  callback(err, res);
};

module.exports.links = (event, context, callback) => request.errorHandler(() => {
  validation.validate(event, {
    auth: true,
    path: {
      appId: joi.string().required(),
    },
  });
  db.connect(env);
  identity.getUser(env.REGION, event.headers.Authorization)
  .then(user => db.checkAppAccess(event.pathParameters.appId, user.vendor))
  .then(() => {
    aws.config.setPromisesDependency(Promise);
    const s3 = new aws.S3();
    const getSignedUrl = Promise.promisify(s3.getSignedUrl.bind(s3));
    const validity = 3600;
    Promise.all([
      getSignedUrl(
        'putObject',
        {
          Bucket: env.S3_BUCKET,
          Key: `${event.pathParameters.appId}/32/latest.png`,
          Expires: validity,
          ContentType: 'image/png',
          ACL: 'public-read',
        }
      ),
      getSignedUrl(
        'putObject',
        {
          Bucket: env.S3_BUCKET,
          Key: `${event.pathParameters.appId}/64/latest.png`,
          Expires: validity,
          ContentType: 'image/png',
          ACL: 'public-read',
        }
      ),
    ]).then((res) => {
      db.end();
      return request.response(null, {
        32: res[0],
        64: res[1],
        expires: moment().add(validity, 's').utc().format(),
      }, event, context, callback);
    });
  })
  .catch((err) => {
    db.end();
    return request.response(err, null, event, context, callback);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));


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

  db.connect(env);
  aws.config.setPromisesDependency(Promise);
  const s3 = new aws.S3();
  return db.addAppIcon(appId, size)
  .then(version => s3.copyObject(
    {
      CopySource: `${bucket}/${key}`,
      Bucket: bucket,
      Key: `${appId}/${size}/${version}.png`,
      ACL: 'public-read',
    }
  ).promise())
  .then(() => {
    db.end();
    return callback();
  })
  .catch((err) => {
    db.end();
    return callback(err);
  });
}, event, context, (err, res) => dbCallback(err, res, callback));
