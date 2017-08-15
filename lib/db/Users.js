'use strict';

const _ = require('lodash');

class DbUsers {
  constructor(rds, err) {
    this.rds = rds;
    this.err = err;
  }

  createUser(paramsIn) {
    return this.rds.queryAsync('INSERT INTO users SET ?', paramsIn)
      .then(() => null)
      .catch((err) => {
        if (!_.startsWith(err.message, 'ER_DUP_ENTRY')) {
          throw err;
        }
      });
  }

  deleteUser(userName) {
    return this.rds.queryAsync('UPDATE users SET deletedOn=NOW() WHERE id=?', [userName]);
  }

  addUserToVendor(user, vendor) {
    return this.rds.queryAsync('INSERT INTO usersToVendors SET user=?, vendor=?', [user, vendor])
      .catch((err) => {
        if (!_.startsWith(err.message, 'ER_DUP_ENTRY')) {
          throw err;
        }
      });
  }

  removeUserFromVendor(user, vendor) {
    return this.rds.queryAsync('DELETE FROM usersToVendors WHERE user=? AND vendor=?', [user, vendor]);
  }
}

export default DbUsers;
