'use strict';

const Promise = require('bluebird');

class Identity {
  constructor(jwt, err) {
    this.jwt = jwt;
    this.err = err;
  }

  static checkPayload(payload, key) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      throw this.err.unauthorized(`Your token does not contain payload.${key}`);
    }
  }

  getUser(token) {
    const tokenData = this.jwt.decode(token);
    Identity.checkPayload(tokenData, 'sub');
    Identity.checkPayload(tokenData, 'email');
    Identity.checkPayload(tokenData, 'name');
    return new Promise((res) => {
      res({
        id: tokenData.sub,
        email: tokenData.email,
        name: tokenData.name,
        vendors: Object.prototype.hasOwnProperty.call(tokenData, 'cognito:groups')
          ? tokenData['cognito:groups'] : [],
        isAdmin: Object.prototype.hasOwnProperty.call(tokenData, 'custom:isAdmin')
          ? parseInt(tokenData['custom:isAdmin'], 10) === 1 : false,
      });
    });
  }

  getAdmin(token) {
    return this.getUser(token)
      .then((user) => {
        if (!user.isAdmin) {
          throw this.err.forbidden();
        }
        return user;
      });
  }
}

export default Identity;
