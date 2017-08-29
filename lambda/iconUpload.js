'use strict';

import Icon from '../app/icon';
import Services from '../lib/services';

require('longjohn');
require('source-map-support').install();
const _ = require('lodash');
const sharp = require('sharp');

const db = require('../lib/db');
const request = require('../lib/request');

const app = new Icon(Services, db, process.env);


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
    () => app.upload(sharp, appId, bucket, key),
    event,
    context,
    callback
  );
}, event, context, callback);
