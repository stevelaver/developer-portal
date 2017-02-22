'use strict';

import App from '../lib/app';
import Identity from '../lib/identity';

require('longjohn');
require('babel-polyfill');
const _ = require('lodash');
const aws = require('aws-sdk');
const db = require('../lib/db');
const error = require('../lib/error');
const jimp = require('jimp');
const Promise = require('bluebird');
const request = require('../lib/request');

aws.config.setPromisesDependency(Promise);
const s3 = new aws.S3();

const app = new App(db, Identity, process.env, error);


module.exports.upload = (event, context, callback) => request.errorHandler(() => {
  if (!_.has(event, 'Records') || !event.Records.length ||
    !_.has(event.Records[0], 's3') || !_.has(event.Records[0].s3, 'bucket') ||
    !_.has(event.Records[0].s3, 'object') ||
    !_.has(event.Records[0].s3.bucket, 'name') ||
    !_.has(event.Records[0].s3.object, 'key')) {
    throw Error(`Event is missing. See: ${JSON.stringify(event)}`);
  }

  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const path = key.split('/');
  const appId = path[1];

  if (
    event.Records[0].eventName !== 'ObjectCreated:Put'
    || path.length !== 3
    || path[0] !== 'icons'
    || path[2] !== 'upload.png'
  ) {
    return callback();
  }
  console.log(JSON.stringify(event));
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => app.uploadIcon(s3, jimp, appId, bucket, key)),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
