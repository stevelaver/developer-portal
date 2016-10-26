'use strict';

const html = module.exports;

html.error = function (err, requestId) {
  return html.page(err, `
    Request Id ${requestId}
  `);
};

html.page = function (header, text) {
  return `
<html>
  <head>
    <title>Keboola Developer Portal</title>
    <meta charset="utf-8">
  </head>
  <body>
    <h1>${header}</h1>
    <p>${text}</p>
  </body>
</html>
  `;
};
