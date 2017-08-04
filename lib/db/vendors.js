'use strict';

const _ = require('lodash');

class DbVendors {
  constructor(rds, err) {
    this.rds = rds;
    this.err = err;
  }

  list(offset = 0, limit = 1000) {
    return this.rds.queryAsync(
      'SELECT id, name, address, email ' +
      'FROM vendors ' +
      'WHERE isPublic=1 AND isApproved=1 ' +
      'ORDER BY id LIMIT ? OFFSET ?;',
      [limit ? _.toSafeInteger(limit) : 1000, _.toSafeInteger(offset)]
    );
  }

  get(id) {
    return this.rds.queryAsync('SELECT * FROM vendors WHERE id = ?', [id])
      .spread((res) => {
        if (!res) {
          throw this.err.notFound();
        }
        return res;
      });
  }

  create(paramsIn) {
    return this.rds.queryAsync('INSERT INTO vendors SET ?', paramsIn);
  }

  update(id, params) {
    return this.rds.queryAsync('UPDATE vendors SET ? WHERE id = ?', [params, id]);
  }
}

export default DbVendors;
