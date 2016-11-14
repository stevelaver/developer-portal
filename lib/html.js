'use strict';

const template = require('../views/public.html');

const html = module.exports;

html.error = (err, requestId) =>
  html.page(err, `
    Request Id: ${requestId}
  `);

html.page = (header, content) =>
  template({
    header,
    content,
  });
