'use strict';

const requestPromise = require('request-promise');

const notification = module.exports;

let hookUrl;
let username;

notification.setHook = function (url, u) {
  hookUrl = url;
  username = u;
};

notification.approveApp = function (app) {
  notification.send(`App ${app.id} requires approval`);
};

notification.approveUser = function (user) {
  notification.send(
    `User ${user.name} <${user.email}> requires approval for vendor ${user.vendor}`
  );
};

notification.send = function (message) {
  if (!hookUrl || !username) {
    throw Error('Slack hook url or username not setup');
  }
  return requestPromise({
    uri: hookUrl,
    method: 'POST',
    json: true,
    body: {
      username,
      text: message,
    },
  });
};
