const _ = require('lodash');

class Vendor {
  constructor(db, err) {
    this.db = db;
    this.err = err;
  }

  list(offset = 0, limit = 1000) {
    return this.db.listVendors(offset, limit);
  }

  get(id) {
    return this.db.getVendor(id);
  }

  create(body) {
    return this.db.createVendor(body)
      .catch((err) => {
        if (_.startsWith('ER_DUP_ENTRY', err.message)) {
          throw this.err.badRequest('The vendor already exists');
        }
      })
      .then(() => null);
  }
}

export default Vendor;
