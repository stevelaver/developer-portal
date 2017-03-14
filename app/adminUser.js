
const _ = require('lodash');

class AdminUser {
  constructor(cognito, db, Identity, env, err) {
    this.cognito = cognito;
    this.db = db;
    this.Identity = Identity;
    this.env = env;
    this.err = err;
  }

  list(filterIn) {
    let filter;
    switch (filterIn) {
      case 'enabled':
        filter = 'status = "Enabled"';
        break;
      case 'disabled':
        filter = 'status = "Disabled"';
        break;
      case 'unconfirmed':
        filter = 'cognito:user_status = "Unconfirmed"';
        break;
      case 'confirmed':
        filter = 'cognito:user_status = "Confirmed"';
        break;
      default:
        filter = '';
    }
    return this.cognito.listUsers({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Filter: filter,
    }).promise()
      .then(data => _.map(data.Users, item => ({
        email: item.Username,
        name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', ''),
        vendors: _.get(_.find(item.Attributes, o => (o.Name === 'profile')), 'Value', '').split(','),
        createdOn: item.UserCreateDate,
        isEnabled: item.Enabled,
        status: item.UserStatus,
      })));
  }

  get(email) {
    return this.cognito.adminGetUser({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
    }).promise()
      .then(data => this.Identity.formatUser(data));
  }

  enable(email) {
    return this.get(email)
      .then((data) => {
        if (data.isEnabled) {
          throw this.err.notFound('The user has been already enabled');
        }
      })
      .then(() => this.cognito.adminEnableUser({
        UserPoolId: this.env.COGNITO_POOL_ID,
        Username: email,
      }).promise());
  }

  makeAdmin(email) {
    return this.get(email)
      .then((data) => {
        if (data.isAdmin) {
          throw this.err.badRequest('The user has been already made admin');
        }
      })
      .then(() => this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.env.COGNITO_POOL_ID,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:isAdmin',
            Value: '1',
          },
        ],
      }).promise());
  }

  addToVendor(email, vendor) {
    return this.db.checkVendorExists(vendor)
      .then(() => this.get(email))
      .then((user) => {
        if (user.vendors.indexOf(vendor) !== -1) {
          throw this.err.badRequest(`User ${email} is already member of vendor ${vendor}`);
        }
        user.vendors.push(vendor);
        return this.cognito.adminUpdateUserAttributes({
          UserPoolId: this.env.COGNITO_POOL_ID,
          Username: email,
          UserAttributes: [
            {
              Name: 'profile',
              Value: user.vendors.join(','),
            },
          ],
        }).promise();
      });
  }

  removeFromVendor(email, vendor) {
    return this.get(email)
      .then((user) => {
        const pos = user.vendors.indexOf(vendor);
        if (pos !== -1) {
          user.vendors.splice(pos, 1);
          return this.cognito.adminUpdateUserAttributes({
            UserPoolId: this.env.COGNITO_POOL_ID,
            Username: email,
            UserAttributes: [
              {
                Name: 'profile',
                Value: user.vendors.join(','),
              },
            ],
          }).promise();
        }
      });
  }
}

export default AdminUser;
