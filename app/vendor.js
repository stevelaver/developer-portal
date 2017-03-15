import DbInvitations from '../lib/db/invitations';
import Email from '../lib/email';
import UserPool from '../lib/UserPool';

const _ = require('lodash');
const aws = require('aws-sdk');

const db = require('../lib/db');

class Vendor {
  constructor(dbIn, env, err) {
    this.db = dbIn;
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

  approve(id, newId = null) {
    return this.db.getVendor(id)
      .then((data) => {
        if (!newId) {
          return this.db.updateVendor(id, { isApproved: true });
        }
        return this.db.checkVendorNotExists(newId)
          .then(() => this.db.updateVendor(id, { id: newId, isApproved: true }))
          .then(() => data.createdBy);
      });
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

  invite(vendor, email, user) {
    const emailLib = new Email(
      new aws.SES({ apiVersion: '2010-12-01', region: this.env.REGION }),
      this.env.SES_EMAIL_FROM
    );
    aws.config.setPromisesDependency(Promise);
    const userPool = new UserPool(
      new aws.CognitoIdentityServiceProvider({ region: this.env.REGION }),
      this.env.COGNITO_POOL_ID,
      this.env.COGNITO_CLIENT_ID,
    );
    if (user.vendors.indexOf(vendor) === -1) {
      throw this.err.forbidden('You do not have access to the vendor');
    }
    return db.connect(this.env)
      .then(() => db.checkVendorExists(vendor))
      .then(() => userPool.getUser(email))
      .then((data) => {
        if (data.vendors.indexOf(vendor) !== -1) {
          throw this.err.forbidden('The user already is member of the vendor');
        }
      })
      .catch((err) => {
        if (err.code !== 'UserNotFoundException') {
          throw err;
        }
      })
      .then(() => new DbInvitations(db.getConnection()))
      .then(dbInvitations => dbInvitations.create(vendor, email, user.email))
      .then(code => emailLib.send(
        email,
        `Invitation to vendor ${vendor}`,
        'Keboola Developer Portal',
        `You have been invited to join vendor ${vendor} by ${user.name}. <a href="${this.env.API_ENDPOINT}/vendors/${vendor}/invitations/${email}/${code}">Accept the invitation</a>`
      ))
      .then(() => db.end())
      .catch((err) => {
        db.end();
        throw err;
      });
  }
}

export default Vendor;
