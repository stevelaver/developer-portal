const Promise = require('bluebird');
const _ = require('lodash');

class App {
  constructor(db, env, err) {
    this.db = db;
    this.env = env;
    this.err = err;
  }

  requestApproval(id, vendor) {
    return this.db.checkAppAccess(id, vendor)
    .then(() => this.db.getApp(id))
    .then((app) => {
      if (app.isApproved) {
        throw this.err.badRequest('Already approved');
      }
      if (!app.repository.type) {
        throw this.err.badRequest('App property repository.type cannot be empty');
      }
      if (!app.repository.uri) {
        throw this.err.badRequest('App property repository.uri cannot be empty');
      }
      if (!app.repository.tag) {
        throw this.err.badRequest('App property repository.tag cannot be empty');
      }
      if (!app.shortDescription) {
        throw this.err.badRequest('App property shortDescription cannot be empty');
      }
      if (!app.longDescription) {
        throw this.err.badRequest('App property longDescription cannot be empty');
      }
      if (!app.licenseUrl) {
        throw this.err.badRequest('App property licenseUrl cannot be empty');
      }
      if (!app.documentationUrl) {
        throw this.err.badRequest('App property documentationUrl cannot be empty');
      }
      if (!app.icon32) {
        throw this.err.badRequest('App icon of size 32px is missing, upload it first.');
      }
      if (!app.icon64) {
        throw this.err.badRequest('App icon of size 64px is missing, upload it first.');
      }
    });
  }

  listAppsForVendor(vendor, offset = 0, limit = 1000) {
    return this.db.listAppsForVendor(vendor, limit, offset);
  }

  getAppForVendor(id, vendor, version = null) {
    return this.db.checkAppAccess(id, vendor)
    .then(() => this.getApp(id, version));
  }

  getApp(id, version = null) {
    return this.db.getApp(id, version)
    .then(appData => App.addIcons(appData, this.env.CLOUDFRONT_URI));
  }

  insertApp(bodyIn, user) {
    const body = JSON.parse(JSON.stringify(bodyIn));
    body.createdBy = user.email;
    body.vendor = user.vendor;
    body.id = `${user.vendor}.${body.id}`;

    return this.db.checkAppNotExists(body.id)
    .then(() => this.db.insertApp(body))
    .then(() => null);
  }

  updateApp(id, body, user) {
    return this.db.checkAppAccess(id, user.vendor)
    .then(() => this.db.updateApp(body, id, user.email))
    .then(() => null);
  }

  listAppVersions(id, vendor, offset = 0, limit = 1000) {
    return this.db.checkAppAccess(id, vendor)
    .then(() => this.db.listVersions(id, offset, limit));
  }

  rollbackAppVersion(id, user) {
    return this.db.checkAppAccess(id, user.vendor)
    .then(() => this.db.getApp(id))
    .then((appIn) => {
      const app = appIn;
      delete app.version;
      return this.db.updateApp(app, id, user.email);
    })
    .then(() => null);
  }

  getIcons(s3, moment, id, vendor) {
    return this.db.checkAppAccess(id, vendor)
    .then(() => {
      const getSignedUrl = Promise.promisify(s3.getSignedUrl.bind(s3));
      const validity = 3600;
      return Promise.all([
        getSignedUrl(
          'putObject',
          {
            Bucket: this.env.S3_BUCKET,
            Key: `icons/${id}/32/latest.png`,
            Expires: validity,
            ContentType: 'image/png',
            ACL: 'public-read',
          }
        ),
        getSignedUrl(
          'putObject',
          {
            Bucket: this.env.S3_BUCKET,
            Key: `icons/${id}/64/latest.png`,
            Expires: validity,
            ContentType: 'image/png',
            ACL: 'public-read',
          }
        ),
      ]).then(res => ({
        32: res[0],
        64: res[1],
        expires: moment().add(validity, 's').utc().format(),
      }));
    });
  }

  uploadIcon(s3, id, size, source) {
    return this.db.addAppIcon(id, size)
    .then(version => s3.copyObject(
      {
        CopySource: source,
        Bucket: this.env.S3_BUCKET,
        Key: `icons/${id}/${size}/${version}.png`,
        ACL: 'public-read',
      }
    ).promise());
  }

  approveApp(id, user) {
    let appData;
    return this.db.getApp(id)
    .then((data) => {
      appData = data;
      if (appData.isApproved) {
        throw this.err.badRequest('Already approved');
      }
      return this.db.updateApp({ isApproved: 1 }, id, user.email);
    })
    .then(() => this.db.getVendor(appData.vendor));
  }

  listApps(filter, offset = 0, limit = 1000) {
    return this.db.listApps(filter, offset, limit);
  }

  makeUserAdmin(cognito, identity, email) {
    return cognito.adminGetUser({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
    }).promise()
    .then((data) => {
      const userData = identity.formatUser(data);
      if (userData.isAdmin) {
        throw this.err.badRequest('Is already admin');
      }
    })
    .then(() => cognito.adminUpdateUserAttributes({
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

  enableUser(cognito, email) {
    let user;
    return cognito.adminGetUser({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
    }).promise()
    .then((data) => {
      if (data.Enabled) {
        throw this.err.notFound('Already Enabled');
      }
      user = data;
    })
    .then(() => cognito.adminEnableUser({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
    }).promise())
    .then(() => user);
  }

  listUsers(cognito, filterIn) {
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
    return cognito.listUsers({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Filter: filter,
    }).promise();
  }

  static addIcons(input, cfUri) {
    const res = input;
    res.icon = {
      32: input.icon32 ? `https://${cfUri}/icons/${input.icon32}` : null,
      64: input.icon64 ? `https://${cfUri}/icons/${input.icon64}` : null,
    };
    delete res.icon32;
    delete res.icon64;
    return res;
  }

  getAppWithVendor(id, version = null, checkPublished = false) {
    return this.db.getAppWithVendor(id, version, checkPublished)
    .then(data => App.addIcons(data, this.env.CLOUDFRONT_URI));
  }

  listPublishedApps(offset = 0, limit = 1000) {
    const cfUri = this.env.CLOUDFRONT_URI;
    return this.db.listPublishedApps(offset, limit)
    .then(res => res.map(r => App.addIcons(r, cfUri)));
  }

  listPublishedAppVersions(id, offset = 0, limit = 1000) {
    const cfUri = this.env.CLOUDFRONT_URI;
    return this.db.listPublishedAppVersions(id, offset, limit)
    .then(res => res.map(r => App.addIcons(r, cfUri)));
  }

  listVendors(offset = 0, limit = 1000) {
    return this.db.listVendors(offset, limit);
  }

  getVendor(id) {
    return this.db.getVendor(id);
  }

  listStacks() {
    return this.db.listStacks();
  }
}

export default App;
