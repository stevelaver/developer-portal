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

  updateUserAttribute(email, attribute, value) {
    return this.cognito.adminUpdateUserAttributes({
      UserPoolId: this.poolId,
      Username: email,
      UserAttributes: [
        {
          Name: attribute,
          Value: value,
        },
      ],
    }).promise();
  }

  addVendorToUser(email, vendor) {
    return this.getUser(email)
      .then((user) => {
        if (user.vendors.indexOf(vendor) !== -1) {
          throw this.err.badRequest(`User ${email} is already member of vendor ${vendor}`);
        }
        user.vendors.push(vendor);
        return this.updateUserAttribute(email, 'profile', user.vendors.join(','));
      });
  }
}

export default UserPool;
