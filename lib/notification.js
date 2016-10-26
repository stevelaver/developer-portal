'use strict';

const request = require('request');

const notification = module.exports;

let hookUrl;
let channel;

notification.setHook = function (url, ch) {
  hookUrl = url;
  channel = ch;
};

notification.approveApp = function (app, cb) {
  notification.send(`App ${app.id} requires approval`, cb);
};

notification.approveUser = function (user, cb) {
  notification.send(
    `User ${user.name} <${user.email}> requires approval in vendor ${user.vendor}`,
    cb,
  );
};

notification.send = function (message, cb) {
  if (!hookUrl || !channel) {
    cb(Error('Slack hook url or channel not setup'));
  }
  request.post({
    url: hookUrl,
    json: true,
    body: {
      channel,
      text: message,
    },
  }, err => cb(err));
};
