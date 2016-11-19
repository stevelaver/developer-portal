const Promise = require('bluebird');

class App {
  constructor(db, env, err) {
    this.db = db;
    this.env = env;
    this.err = err;
  }

  approve(id, vendor) {
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

  listAppsForVendor(vendor, offset = 0, limit = 100) {
    return this.db.listAppsForVendor(vendor, limit, offset);
  }

  getApp(id, vendor, version = null) {
    return this.db.checkAppAccess(id, vendor)
    .then(() => this.db.getApp(id, version))
    .then((appIn) => {
      const app = appIn;
      app.icon = {
        32: app.icon32 ? `https://${this.env.CLOUDFRONT_URI}/${app.icon32}` : null,
        64: app.icon64 ? `https://${this.env.CLOUDFRONT_URI}/${app.icon64}` : null,
      };
      delete app.icon32;
      delete app.icon64;
      return app;
    });
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

  listAppVersions(id, vendor, offset = 0, limit = 100) {
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
            Key: `${id}/32/latest.png`,
            Expires: validity,
            ContentType: 'image/png',
            ACL: 'public-read',
          }
        ),
        getSignedUrl(
          'putObject',
          {
            Bucket: this.env.S3_BUCKET,
            Key: `${id}/64/latest.png`,
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
        Key: `${id}/${size}/${version}.png`,
        ACL: 'public-read',
      }
    ).promise());
  }
}

export default App;
