'use strict';

import Notification from '../../lib/notification';

const Promise = require('bluebird');

require('dotenv').config({ path: '.env-test', silent: true });

const sinon = require('sinon');

describe('notification', () => {
  it('test notification', () => {
    const request = {
      post: sinon.stub().returns(Promise.resolve()),
    };
    const notification = new Notification(request, 'url', 'username');
    notification.approveApp('app')
      .then(() => {
        request.post.calledWith({
          uri: 'url',
          method: 'POST',
          json: true,
          body: {
            username: 'username',
            text: 'App app requires approval',
          },
        });
      });
  });
});
