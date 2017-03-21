'use strict';

const _ = require('lodash');

class UserPool {
  constructor(cognito, poolId, clientId, Identity, err) {
    this.cognito = cognito;
    this.poolId = poolId;
    this.clientId = clientId;
    this.Identity = Identity;
    this.err = err;
  }

  getCognito() {
    return this.cognito;
  }

  getUser(email) {
    return this.cognito.adminGetUser({
      UserPoolId: this.poolId,
      Username: email,
    }).promise()
      .then(data => this.Identity.formatUser(data));
  }

  listUsers(filterIn) {
    let filter;
    switch (filterIn) {
      case 'enabled':
        filter = 'status = "Enabled"';
        break;
      case 'disabled':
        filter = 'status = "Disabled"';
        break;
      case 'unconfirmed':
        filter = 'cognito:user_status = "Unconfirmed"';
        break;
      case 'confirmed':
        filter = 'cognito:user_status = "Confirmed"';
        break;
      default:
        filter = '';
    }
    return this.cognito.listUsers({
      UserPoolId: this.poolId,
      Filter: filter,
    }).promise()
      .then(data => _.map(data.Users, item => ({
        email: item.Username,
        name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', ''),
        vendors: _.get(_.find(item.Attributes, o => (o.Name === 'profile')), 'Value', '').split(','),
        createdOn: item.UserCreateDate,
        isEnabled: item.Enabled,
        status: item.UserStatus,
      })));
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

  addUserToVendor(email, vendor) {
    return this.getUser(email)
      .then((user) => {
        if (user.vendors.indexOf(vendor) !== -1) {
          throw this.err.badRequest(`User ${email} is already member of vendor ${vendor}`);
        }
        user.vendors.push(vendor);
        return this.updateUserAttribute(email, 'profile', user.vendors.join(','));
      });
  }

  removeUserFromVendor(email, vendor) {
    return this.getUser(email)
      .then((user) => {
        const pos = user.vendors.indexOf(vendor);
        if (pos !== -1) {
          user.vendors.splice(pos, 1);
          return this.updateUserAttribute(email, 'profile', user.vendors.join(','));
        }
      });
  }

  enableUser(email) {
    return this.getUser(email)
      .then((data) => {
        if (data.isEnabled) {
          throw this.err.notFound('The user has been already enabled');
        }
      })
      .then(() => this.cognito.adminEnableUser({
        UserPoolId: this.poolId,
        Username: email,
      }).promise());
  }

  makeUserAdmin(email) {
    return this.getUser(email)
      .then((data) => {
        if (data.isAdmin) {
          throw this.err.badRequest('The user has been already made admin');
        }
      })
      .then(() => this.updateUserAttribute(email, 'custom:isAdmin', '1'));
  }

  deleteUser(email) {
    return this.cognito.adminDeleteUser({ UserPoolId: this.poolId, Username: email }).promise();
  }

  forgotPassword(email) {
    return this.cognito.forgotPassword({
      ClientId: this.clientId,
      Username: email,
    }).promise();
  }

  confirmForgotPassword(email, password, code) {
    return this.cognito.confirmForgotPassword({
      ClientId: this.clientId,
      ConfirmationCode: code,
      Password: password,
      Username: email,
    }).promise();
  }

  signUp(email, password, name) {
    return this.cognito.signUp({
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'name',
          Value: name,
        },
      ],
    }).promise();
  }
}

export default UserPool;
