'use strict';

const request = require('request'); // Leave it here or Webpack skipps it
const requestPromise = require('request-promise');

const notification = module.exports;

let hookUrl;
let username;

notification.setHook = function (url, u) {
  hookUrl = url;
  username = u;
};

notification.approveApp = function (appId) {
  notification.send(`App ${appId} requires approval`);
};

notification.approveUser = function (user) {
  notification.send(
    `User ${user.name} <${user.email}> requires approval for vendor ${user.vendors[0]}`
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
