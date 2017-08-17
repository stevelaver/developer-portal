import DbInvitations from '../lib/db/invitations';
import DbVendors from '../lib/db/vendors';
import DbUsers from '../lib/db/Users';

const _ = require('lodash');
const moment = require('moment');

const db = require('../lib/db');

class Vendor {
  constructor(services, dbIn, env, err) {
    this.services = services;
    this.db = dbIn;
    this.env = env;
    this.err = err;
  }

  list(offset = 0, limit = 1000) {
    return new Promise(res => res(new DbVendors(this.db.getConnection(), this.err)))
      .then(dbVendors => dbVendors.list(offset, limit));
  }

  get(id) {
    return new Promise(res => res(new DbVendors(this.db.getConnection(), this.err)))
      .then(dbVendors => dbVendors.publicGetVendor(id));
  }

  create(body, isApproved = true) {
    const params = _.clone(body);
    if (!_.has(params, 'id')) {
      params.id = `_v${Date.now()}${Math.random()}`.substr(0, 32);
    }
    params.isApproved = isApproved;
    return new Promise(res => res(new DbVendors(this.db.getConnection(), this.err)))
      .then(dbVendors => dbVendors.create(params)
        .then(() => dbVendors.publicGetVendor(params.id)))
      .catch((err) => {
        if (_.startsWith(err.message, 'ER_DUP_ENTRY')) {
          throw this.err.badRequest('The vendor already exists');
        }
      });
  }

  updateVendor(vendor, data, user) {
    this.checkVendorAccess(user, vendor);
    return new Promise(res => res(new DbVendors(this.db.getConnection(), this.err)))
      .then(dbVendors => dbVendors.update(vendor, data)
        .then(() => dbVendors.publicGetVendor(vendor)));
  }

  approve(id, newId = null) {
    if (!newId) {
      return new Promise(res => res(new DbVendors(this.db.getConnection(), this.err)))
        .then(dbVendors => dbVendors.update(id, { isApproved: true })
          .then(() => dbVendors.get(id)));
    }
    return this.db.checkVendorNotExists(newId)
      .then(() => new DbVendors(this.db.getConnection(), this.err))
      .then(dbVendors => dbVendors.update(id, { id: newId, isApproved: true })
        .then(() => dbVendors.get(newId)));
  }

  checkVendorExists(vendor) {
    return this.db.checkVendorExists(vendor);
  }

  adminJoinVendor(user, vendor) {
    return this.db.checkVendorExists(vendor)
      .then(() => this.services.getUserPoolWithDatabase(this.db))
      .then(userPool => userPool.addUserToVendor(user.email, vendor));
  }

  addUserRequestToVendor(username, vendor) {
    return this.get(vendor)
      .then(vendorData => this.services.getUserPoolWithDatabase(this.db)
        .then(userPool => userPool.addUserRequestToVendor(username, vendor))
        .then(() => vendorData));
  }

  acceptRequestJoinVendor(username, vendor, user) {
    this.checkVendorAccess(user, vendor);
    return this.get(vendor)
      .then(() => this.services.getUserPoolWithDatabase(this.db))
      .then(userPool => userPool.removeUserRequestToVendor(username, vendor)
        .then(() => userPool.addUserToVendor(username, vendor)));
  }

  invite(vendor, email, user) {
    this.checkVendorAccess(user, vendor);
    const emailLib = this.services.getEmail();
    const userPool = this.services.getUserPool();
    return db.checkVendorExists(vendor)
      .then(() => userPool.getUser(email))
      .then((data) => {
        if (data.vendors.indexOf(vendor) !== -1) {
          db.end();
          throw this.err.unprocessable('The user is already member of the vendor');
        }
      })
      .catch((err) => {
        if (err.code !== 'UserNotFoundException') {
          db.end();
          throw err;
        }
      })
      .then(() => new DbInvitations(db.getConnection(), this.err))
      .then(dbInvitations => dbInvitations.create(vendor, email, user.email))
      .then(code => emailLib.send(
        email,
        `Invitation to vendor ${vendor}`,
        'Keboola Developer Portal',
        `You have been invited to join vendor ${vendor} by ${user.name}. <a href="${this.env.API_ENDPOINT}/vendors/${vendor}/invitations/${email}/${code}">Accept the invitation</a>`
      ));
  }

  acceptInvitation(vendor, email, code) {
    return new Promise(res => res(new DbInvitations(db.getConnection(), this.err)))
      .then(dbInvitations => dbInvitations.get(code)
        .then((data) => {
          if (data.acceptedOn) {
            throw this.err.badRequest('You have already accepted the invitation.');
          }
          const validLimit = moment().subtract(24, 'hours');
          if (moment(data.createdOn).isBefore(validLimit)) {
            throw this.err.badRequest('Your invitation expired. Please ask for a new one.');
          }
        })
        .then(() => this.services.getUserPoolWithDatabase(this.db))
        .then(userPool => userPool.addUserToVendor(email, vendor))
        .then(() => dbInvitations.accept(code)))
      .catch((err) => {
        if (err.code === 'UserNotFoundException') {
          throw this.err.notFound('User account does not exist. Please signup first.');
        }
        throw err;
      });
  }

  removeUser(vendor, username, user) {
    this.checkVendorAccess(user, vendor);
    return db.checkVendorExists(vendor)
      .then(() => new DbUsers(this.db.getConnection(), this.err))
      .then(dbUsers => dbUsers.getUser(username)
        .then((data) => {
          if (data.deletedOn || !_.includes(data.vendors, vendor)) {
            throw this.err.notFound('User not found');
          }
          return this.services.getUserPoolWithDatabase(this.db)
            .then((userPoolDb) => {
              if (data.serviceAccount) {
                return userPoolDb.deleteUser(username);
              }
              return userPoolDb.removeUserFromVendor(username, vendor)
                .then(() => {
                  if (user.email !== username) {
                    const emailLib = this.services.getEmail();
                    return emailLib.send(
                      username,
                      `Removal from vendor ${vendor}`,
                      'Keboola Developer Portal',
                      `Your account was removed from vendor ${vendor} by ${user.name}.`
                    );
                  }
                });
            });
        }));
  }

  static generatePassword(generator) {
    return generator.generate({
      length: 64,
      numbers: true,
      symbols: true,
      uppercase: true,
      exclude: '!@#$%^&*()\\=}{[]|:;"/?><,`~',
    });
  }

  createServiceUser(vendor, name, description, user, generator) {
    this.checkVendorAccess(user, vendor);
    const userPool = this.services.getUserPool();
    const username = `${vendor}+${name}`;

    while (true) { // eslint-disable-line no-constant-condition
      const password = Vendor.generatePassword(generator);
      return this.services.getUserPoolWithDatabase(this.db)
        .then(userPoolDb => userPoolDb.signUp(username, password, `Service ${vendor}`, description, false)
          .then(() => userPool.confirmSignUp(username))
          .then(() => userPoolDb.addUserToVendor(username, vendor))
          .then(() => ({
            username,
            password,
            description,
            createdOn: moment().toISOString(),
          })))
        .catch((err) => {
          if (err.code === 'UsernameExistsException') {
            throw this.err.badRequest(`User with name ${username} already exists`);
          }
          throw err;
        });
    }
  }

  listUsers(vendor, user, serviceAccount = false, offset = 0, limit = 1000) {
    this.checkVendorAccess(user, vendor);
    return this.services.getUserPoolWithDatabase(this.db)
      .then((userPool) => {
        if (serviceAccount) {
          return userPool.listServiceUsersForVendor(vendor, offset, limit);
        }
        return userPool.listUsersForVendor(vendor, offset, limit);
      });
  }

  listUserRequests(vendor, user, offset = 0, limit = 1000) {
    this.checkVendorAccess(user, vendor);
    return this.services.getUserPoolWithDatabase(this.db)
      .then(userPool => userPool.listUserRequestsForVendor(vendor, offset, limit));
  }

  checkVendorAccess(user, vendor) {
    if (!user.isAdmin && user.vendors.indexOf(vendor) === -1) {
      throw this.err.forbidden('You do not have access to the vendor');
    }
  }
}

export default Vendor;
