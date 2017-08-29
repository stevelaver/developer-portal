'use strict';

const _ = require('lodash');

class UserPoolWithDatabase {
  constructor(userPool, dbUsers) {
    this.userPool = userPool;
    this.dbUsers = dbUsers;
  }

  getCognito() {
    return this.cognito;
  }

  static formatUser(user) {
    return {
      username: user.username,
      name: user.name,
      createdOn: user.createdOn,
      vendors: user.vendors ? _.split(user.vendors, ',') : [],
    };
  }

  listUsersForVendor(vendor, offset = 0, limit = 1000) {
    return this.dbUsers.listUsersForVendor(vendor, offset, limit)
      .then(res => res.map(r => UserPoolWithDatabase.formatUser(r)));
  }

  listServiceUsersForVendor(offset = 0, limit = 1000) {
    return this.dbUsers.listServiceUsersForVendor(offset, limit);
  }

  listAllUsers(offset = 0, limit = 1000) {
    return this.dbUsers.listAllUsers(offset, limit)
      .then(res => res.map(r => UserPoolWithDatabase.formatUser(r)));
  }

  deleteUser(userName) {
    return this.userPool.deleteUser(userName)
      .then(() => this.dbUsers.deleteUser(userName));
  }

  signUp(userName, password, name, description = null, isRealUser = true) {
    return this.userPool.signUp(userName, password, name, description, isRealUser)
      .then(() => this.dbUsers.createUser({
        id: userName,
        name,
        description,
        serviceAccount: !isRealUser,
      }));
  }

  addUserToVendor(username, vendor) {
    return this.userPool.addUserToVendor(username, vendor)
      .then(() => this.dbUsers.addUserToVendor(username, vendor));
  }

  removeUserFromVendor(username, vendor) {
    return this.userPool.removeUserFromVendor(username, vendor)
      .then(() => this.dbUsers.removeUserFromVendor(username, vendor));
  }

  addUserRequestToVendor(username, vendor) {
    return this.dbUsers.addUserRequestToVendor(username, vendor);
  }

  removeUserRequestToVendor(username, vendor) {
    return this.dbUsers.removeUserRequestToVendor(username, vendor);
  }

  listUserRequestsForVendor(username, vendor) {
    return this.dbUsers.listUserRequestsForVendor(username, vendor);
  }
}

export default UserPoolWithDatabase;
