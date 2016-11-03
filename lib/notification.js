'use strict';

const request = require('request');
const requestPromise = require('request-promise');

const notification = module.exports;

let hookUrl;
let username;

notification.setHook = function (url, u) {
  hookUrl = url;
  username = u;
};

notification.approveApp = function (app, cb = null) {
  notification.send(`App ${app.id} requires approval`, cb);
};

notification.approveUser = function (user, cb = null) {
  notification.send(
    `User ${user.name} <${user.email}> requires approval for vendor ${user.vendor}`,
    cb,
  );
};

notification.send = function (message, cb = null) {
  if (!hookUrl || !username) {
    cb(Error('Slack hook url or username not setup'));
  }
  if (cb) {
    request.post({
      url: hookUrl,
      json: true,
      body: {
        username,
        text: message,
      },
    }, err => cb(err));
  } else {
    return requestPromise({
      uri: hookUrl,
      method: 'POST',
      json: true,
      body: {
        username,
        text: message,
      },
    });
  }
};
