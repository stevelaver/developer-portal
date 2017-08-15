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

  listUsers(filter, paginationToken = null) {
    return this.userPool.listUsers(filter, paginationToken);
  }

  listUsersAll(vendor, paginationToken) {
    return this.userPool.listUsersAll(vendor, paginationToken);
  }

  listUsersPaginated(vendor, offset = 0, limit = 1000) {
    return this.dbUsers.listUsers(vendor, offset, limit)
      .then(res => res.map(r => ({
        email: r.email,
        name: r.name,
        createdOn: r.createdOn,
        vendors: _.split(r.vendors, ','),
      })));
  }

  listUsersForVendor(vendor, paginationToken) {
    return this.userPool.listUsersForVendor(vendor, paginationToken);
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
