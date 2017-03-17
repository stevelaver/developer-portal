'use strict';

const sha1 = require('crypto-js/sha1');

class DbInvitations {
  constructor(rds, err) {
    this.rds = rds;
    this.err = err;
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
        return this.rds.queryAsync(
          'UPDATE invitations SET createdBy=? AND createdOn=NOW() WHERE code=?',
          [createdBy, code]
        )
          .then(() => res.code);
      });
  }

  get(code) {
    return this.rds.queryAsync('SELECT * FROM invitations WHERE code=?', [code])
      .spread((res) => {
        if (!res) {
          throw this.err.badRequest('Code in url is not valid');
        }
        return res;
      });
  }

  accept(code) {
    return this.rds.queryAsync('UPDATE invitations SET acceptedOn=NOW() WHERE code=?', [code]);
  }
}

export default DbInvitations;
