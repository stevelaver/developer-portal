const _ = require('lodash');

class Vendor {
  constructor(db, env, err) {
    this.db = db;
    this.env = env;
    this.err = err;
  }

  list(offset = 0, limit = 1000) {
    return this.db.listVendors(offset, limit);
  }

  get(id) {
    return this.db.getVendor(id);
  }

  create(body, isApproved = true) {
    const params = _.clone(body);
    params.isApproved = isApproved;
    return this.db.createVendor(params)
      .catch((err) => {
        if (_.startsWith('ER_DUP_ENTRY', err.message)) {
          throw this.err.badRequest('The vendor already exists');
        }
      })
      .then(() => null);
  }

  join(cognito, Identity, user, vendor) {
    return this.db.connect(this.env)
      .then(() => this.db.checkVendorExists(vendor))
      .then(() => this.db.end())
      .catch((err) => {
        this.db.end();
        throw err;
      })
      .then(() => cognito.adminGetUser({
        UserPoolId: this.env.COGNITO_POOL_ID,
        Username: user.email,
      }).promise())
      .then(data => Identity.formatUser(data))
      .then((data) => {
        if (data.vendors.indexOf(vendor) !== -1) {
          throw this.err.badRequest(`User ${user.email} is already member of vendor ${vendor}`);
        }
        data.vendors.push(vendor);
        return cognito.adminUpdateUserAttributes({
          UserPoolId: this.env.COGNITO_POOL_ID,
          Username: user.email,
          UserAttributes: [
            {
              Name: 'profile',
              Value: data.vendors.join(','),
            },
          ],
        }).promise();
      });
  }
}

export default Vendor;
