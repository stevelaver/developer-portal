'use strict';

class UserPool {
  constructor(cognito, poolId, clientId, Identity) {
    this.cognito = cognito;
    this.poolId = poolId;
    this.clientId = clientId;
    this.Identity = Identity;
  }

  getUser(email) {
    return this.cognito.adminGetUser({
      UserPoolId: this.poolId,
      Username: email,
    }).promise()
      .then(data => this.Identity.formatUser(data));
  }
}

export default UserPool;
