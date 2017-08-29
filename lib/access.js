'use strict';

const Promise = require('bluebird');

class Access {
  constructor(db, err) {
    this.db = db;
    this.err = err;
  }

  checkVendor(user, vendor) {
    return new Promise((resolve, reject) => {
      if (user.vendors.indexOf(vendor) === -1 && !user.isAdmin) {
        reject(this.err.unauthorized(`You do not have permissions to use vendor ${vendor}`));
      }
      resolve();
    });
  }

  checkApp(user, vendor, id) {
    return this.checkVendor(user, vendor)
      .then(() => {
        if (!user.isAdmin) {
          return this.db.checkAppAccess(id, vendor);
        }
        return this.db.checkAppExists(id);
      });
  }
}

export default Access;
