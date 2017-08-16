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

  listUsersForVendor(vendor, offset = 0, limit = 1000) {
    return this.dbUsers.listUsersForVendor(vendor, offset, limit)
      .then(res => res.map(r => ({
        email: r.email,
        name: r.name,
        createdOn: r.createdOn,
        vendors: _.split(r.vendors, ','),
      })));
  }

  listAllUsers(offset = 0, limit = 1000) {
    return this.dbUsers.listAllUsers(offset, limit)
      .then(res => res.map(r => ({
        email: r.email,
        name: r.name,
        createdOn: r.createdOn,
        vendors: _.split(r.vendors, ','),
      })));
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

  addUserToVendor(email, vendor) {
    return this.userPool.addUserToVendor(email, vendor)
      .then(() => this.dbUsers.addUserToVendor(email, vendor));
  }

  removeUserFromVendor(email, vendor) {
    return this.userPool.removeUserFromVendor(email, vendor)
      .then(() => this.dbUsers.removeUserFromVendor(email, vendor));
  }
}

export default UserPoolWithDatabase;
