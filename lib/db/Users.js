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

  listUsers(vendor, offset = 0, limit = 1000) {
    return this.rds.queryAsync(
      'SELECT u.id AS email, u.name, u.createdOn, GROUP_CONCAT(uvv.vendor) AS vendors ' +
      'FROM usersToVendors uv ' +
      'LEFT JOIN users u ON (u.id=uv.user) ' +
      'LEFT JOIN usersToVendors uvv ON (u.id=uvv.user) ' +
      'WHERE uv.vendor=? AND u.deletedOn IS NULL ' +
      'GROUP BY u.id ORDER BY email LIMIT ? OFFSET ?',
      [vendor, limit ? _.toSafeInteger(limit) : 1000, _.toSafeInteger(offset)]
    );
  }
}

export default DbUsers;
