'use strict';

require('babel-polyfill');
const db = require('../../lib/db');
const request = require('../../lib/request');


/**
 * Stacks List
 */
module.exports.stacksList = (event, context, callback) => request.errorHandler(() => {
  return request.responseDbPromise(
    db.connect(process.env)
      .then(() => db.listStacks()),
    db,
    event,
    context,
    callback
  );
}, event, context, (err, res) => db.endCallback(err, res, callback));
