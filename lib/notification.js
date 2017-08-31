'use strict';

class Notification {
  constructor(request, url, username) {
    this.request = request;
    this.url = url;
    this.username = username;
  }

  publishApp(appId) {
    return this.send(`App ${appId} requires publishing`);
  }

  approveVendor(id, name, user) {
    return this.send(
      `User ${user.name} <${user.email}> requires creation of vendor ${name} with temporary id ${id}`
    );
  }

  approveJoinVendor(user, vendor) {
    return this.send(
      `User ${user.name} <${user.email}> requires joining vendor ${vendor}`
    );
  }

  send(message) {
    return this.request.post(
      this.url,
      {
        method: 'POST',
        body: JSON.stringify({
          username: this.username,
          text: message,
        }),
      },
    ).then(() => null);
  }
}

export default Notification;
