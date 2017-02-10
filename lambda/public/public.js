'use strict';

require('babel-polyfill');
const error = require('../../lib/error');
const html = require('../../views/landing.html');
const request = require('../../lib/request');


/**
 * Landing Page
 */
module.exports.public = (event, context, callback) => request.htmlErrorHandler(() => {
  if (event.resource === '/' && event.httpMethod === 'GET') {
    return callback(null, {
      headers: { 'Content-Type': 'text/html' },
      body: html({ apiEndpoint: process.env.API_ENDPOINT }),
      statusCode: 200,
    });
  }
  throw error.notFound();
}, event, context, callback);
