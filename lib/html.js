'use strict';

const template = require('../views/public.html');

const html = module.exports;

html.error = function (err, requestId) {
  return html.page(err, `
    Request Id ${requestId}
  `);
};

html.page = function (header, content) {
  return template({
    header,
    content,
  });
};
