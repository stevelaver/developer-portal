'use strict';

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

  listUsersAllAtOnce(vendor) {
    return this.userPool.listUsersAllAtOne(vendor);
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
