const _ = require('lodash');
const Promise = require('bluebird');

class App {
  constructor(db, Identity, env, err) {
    this.db = db;
    this.Identity = Identity;
    this.env = env;
    this.err = err;
  }

  requestApproval(id, vendor, user) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
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
        if (!app.icon64) {
          throw this.err.badRequest('App icon is missing, upload it first.');
        }
      });
  }

  listAppsForVendor(vendor, user, offset = 0, limit = 1000) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.listAppsForVendor(vendor, offset, limit));
  }

  getAppForVendor(id, vendor, user, version = null) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
      .then(() => this.getApp(id, version));
  }

  getApp(id, version = null) {
    return this.db.getApp(id, version)
    .then(appData => App.addIcons(appData, this.env.CLOUDFRONT_URI));
  }

  createApp(bodyIn, vendor, user) {
    const body = JSON.parse(JSON.stringify(bodyIn));
    body.createdBy = user.email;
    body.vendor = vendor;
    body.id = `${vendor}.${body.id}`;
    body.isPublic = 0;

    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppNotExists(body.id))
      .then(() => this.db.checkVendorExists(vendor))
      .then(() => this.db.insertApp(body))
      .then(() => null);
  }

  updateApp(id, vendor, body, user) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
      .then(() => this.db.checkVendorExists(vendor))
      .then(() => {
        if ('isPublic' in body && body.isPublic === true) {
          return this.db.checkAppCanBePublished(id);
        }
      })
      .then(() => this.db.updateApp(body, id, user.email))
      .then(() => null);
  }

  updateAppByAdmin(id, body, user) {
    return this.db.updateApp(body, id, user.email)
      .then(() => null);
  }

  listAppVersions(id, vendor, user, offset = 0, limit = 1000) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
      .then(() => this.db.listVersions(id, offset, limit));
  }

  listAppChanges(since = null, until = null) {
    return this.db.getLatestVersions(since, until)
      .then((res) => {
        const promises = [];
        _.each(res, (app) => {
          promises.push(new Promise(resolve =>
            this.db.getAppVersion(app.id, app.version - 1)
              .catch((err) => {
                if (err.code !== 404) {
                  throw err;
                }
                resolve({
                  id: app.id,
                  createdOn: app.createdOn,
                  createdBy: app.createdBy,
                  changes: [
                    {
                      attribute: 'id',
                      oldValue: null,
                      newValue: app.id,
                      description: `App ${app.id} created`,
                    },
                  ],
                });
              })
              .then((prev) => {
                const prevCopy = prev ? _.cloneDeep(prev) : {};
                const nextCopy = app ? _.cloneDeep(this.db.formatAppOutput(app)) : {};
                delete prevCopy.version;
                delete prevCopy.createdBy;
                delete prevCopy.createdOn;
                delete prevCopy.vendor;
                delete nextCopy.version;
                delete nextCopy.createdBy;
                delete nextCopy.createdOn;
                delete nextCopy.vendor;
                const changes = [];
                _.forIn(prevCopy, (val, key) => {
                  if (!_.has(nextCopy, key)) {
                    changes.push({
                      attribute: key,
                      oldValue: prevCopy[key],
                      newValue: null,
                      description: `Attribute ${key} deleted`,
                    });
                  } else if (!_.isEqual(prevCopy[key], nextCopy[key])) {
                    changes.push({
                      attribute: key,
                      oldValue: prevCopy[key],
                      newValue: nextCopy[key],
                      description: `Attribute ${key} changed`,
                    });
                  }
                });
                _.forIn(nextCopy, (val, key) => {
                  if (!_.has(prevCopy, key)) {
                    changes.push({
                      attribute: key,
                      oldValue: null,
                      newValue: nextCopy[key],
                      description: `Attribute ${key} added`,
                    });
                  }
                });

                resolve({
                  id: app.id,
                  createdOn: app.createdOn,
                  createdBy: app.createdBy,
                  changes,
                });
              })
          ));
        });
        return Promise.all(promises);
      });
  }

  rollbackAppVersion(id, vendor, user, version) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
      .then(() => this.db.getApp(id, version))
      .then((appIn) => {
        const app = appIn;
        delete app.version;
        return this.db.updateApp(app, id, user.email);
      })
      .then(() => null);
  }

  approveApp(id, user) {
    let appData;
    return this.db.getApp(id)
    .then((data) => {
      appData = data;
      if (appData.isApproved) {
        throw this.err.badRequest('The user has been already approved');
      }
      return this.db.updateApp({ isApproved: 1 }, id, user.email);
    })
    .then(() => this.db.getVendor(appData.vendor));
  }

  listApps(filter, offset = 0, limit = 1000) {
    return this.db.listApps(filter, offset, limit);
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

  getAppWithVendorForAdmin(id, version = null, checkPublished = false) {
    return this.db.getAppWithVendor(id, version, checkPublished, true)
      .then(data => App.addIcons(data, this.env.CLOUDFRONT_URI));
  }

  listPublishedApps(offset = 0, limit = 1000) {
    const cfUri = this.env.CLOUDFRONT_URI;
    return this.db.listPublishedApps(offset, limit)
    .then(res => res.map(r => App.addIcons(r, cfUri)));
  }
}

export default App;
