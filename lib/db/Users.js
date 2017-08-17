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

  getUser(username) {
    return this.rds.queryAsync(
      'SELECT u.id AS username, u.name, u.description, u.serviceAccount, u.createdOn, u.deletedOn, GROUP_CONCAT(uvv.vendor) AS vendors ' +
      'FROM users u ' +
      'LEFT JOIN usersToVendors uvv ON (u.id=uvv.user) ' +
      'WHERE u.id=? ' +
      'GROUP BY u.id',
      [username]
    )
      .spread((res) => {
        if (!res) {
          throw this.err.notFound('User not found');
        }
        return res;
      });
  }

  deleteUser(username) {
    return this.rds.queryAsync('UPDATE users SET deletedOn=NOW() WHERE id=?', [username]);
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

  listAllUsers(offset = 0, limit = 1000) {
    return this.rds.queryAsync(
      'SELECT u.id AS username, u.name, u.createdOn, GROUP_CONCAT(uvv.vendor) AS vendors ' +
      'FROM users u ' +
      'LEFT JOIN usersToVendors uvv ON (u.id=uvv.user) ' +
      'WHERE u.deletedOn IS NULL AND u.serviceAccount=0 ' +
      'GROUP BY u.id ORDER BY username LIMIT ? OFFSET ?',
      [limit ? _.toSafeInteger(limit) : 1000, _.toSafeInteger(offset)]
    );
  }

  listUsersForVendor(vendor, offset = 0, limit = 1000) {
    return this.rds.queryAsync(
      'SELECT u.id AS username, u.name, u.createdOn, GROUP_CONCAT(uvv.vendor) AS vendors ' +
      'FROM usersToVendors uv ' +
      'LEFT JOIN users u ON (u.id=uv.user) ' +
      'LEFT JOIN usersToVendors uvv ON (u.id=uvv.user) ' +
      'WHERE uv.vendor=? AND u.deletedOn IS NULL AND u.serviceAccount=0 ' +
      'GROUP BY u.id ORDER BY username LIMIT ? OFFSET ?',
      [vendor, limit ? _.toSafeInteger(limit) : 1000, _.toSafeInteger(offset)]
    );
  }

  listServiceUsersForVendor(vendor, offset = 0, limit = 1000) {
    return this.rds.queryAsync(
      'SELECT u.id AS username, u.description, u.createdOn ' +
      'FROM usersToVendors uv ' +
      'LEFT JOIN users u ON (u.id=uv.user) ' +
      'WHERE uv.vendor=? AND u.deletedOn IS NULL AND u.serviceAccount=1 ' +
      'ORDER BY username LIMIT ? OFFSET ?',
      [vendor, limit ? _.toSafeInteger(limit) : 1000, _.toSafeInteger(offset)]
    );
  }
}

export default DbUsers;
