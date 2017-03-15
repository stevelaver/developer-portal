'use strict';

const sha1 = require('crypto-js/sha1');

class DbInvitations {
  constructor(rds) {
    this.rds = rds;
  }

  create(vendor, email, createdBy) {
    let code;
    return this.rds.queryAsync('SELECT * FROM invitations WHERE vendor=? AND email=?', [vendor, email])
      .spread((res) => {
        if (!res) {
          code = sha1(`${Date.now()}${Math.random()}`).toString();
          return this.rds.queryAsync(
            'INSERT INTO invitations SET code=?, vendor=?, email=?, createdBy=?',
            [code, vendor, email, createdBy]
          ).then(() => code);
        }
        return res.code;
      });
  }
}

export default DbInvitations;
