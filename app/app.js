import DbVendors from '../lib/db/vendors';

const _ = require('lodash');
const Promise = require('bluebird');

class App {
  constructor(Services, db, env) {
    this.db = db;
    this.access = Services.getAccess(db);
    this.env = env;
    this.err = Services.getError();
  }

  requestPublishing(id, vendor, user) {
    return this.access.checkApp(user, vendor, id)
      .then(() => this.db.getApp(id))
      .then((app) => {
        if (app.isPublic) {
          throw this.err.badRequest('The app is already set as public');
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

  createApp(bodyIn, vendor, user) {
    const body = JSON.parse(JSON.stringify(bodyIn));
    body.createdBy = user.email;
    body.vendor = vendor;
    body.id = `${vendor}.${body.id}`;
    body.isPublic = 0;

    return this.access.checkVendor(user, vendor)
      .then(() => this.db.checkAppNotExists(body.id))
      .then(() => this.db.checkVendorExists(vendor))
      .then(() => this.db.insertApp(body))
      .then(() => null);
  }

  updateApp(id, vendor, body, user) {
    return this.access.checkApp(user, vendor, id)
      .then(() => this.db.checkVendorExists(vendor))
      .then(() => this.adminUpdateApp(id, body, user.email));
  }

  adminUpdateApp(id, body, user) {
    return this.db.updateApp(body, id, user.email)
      .then(() => null);
  }

  deleteApp(id, vendor, user, moment) {
    return this.access.checkApp(user, vendor, id)
      .then(() => this.db.updateApp({ deletedOn: moment().format('YYYY-MM-DD HH:mm:ss') }, id, user.email))
      .then(() => null);
  }

  listAppVersions(id, vendor, user, offset = 0, limit = 1000) {
    const cfUri = this.env.CLOUDFRONT_URI;
    return this.access.checkApp(user, vendor, id)
      .then(() => this.db.listVersions(id, offset, limit))
      .then(res => res.map(r => App.formatIcons(r, cfUri)));
  }

  adminListChangesAcrossApps(since = null, until = null) {
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
    return this.access.checkApp(user, vendor, id)
      .then(() => this.db.getApp(id, version))
      .then((appIn) => {
        const app = appIn;
        delete app.version;
        return this.db.updateApp(app, id, user.email);
      })
      .then(() => null);
  }

  adminPublishApp(id, user) {
    let appData;
    return this.db.getApp(id)
    .then((data) => {
      appData = data;
      if (appData.isPublic) {
        throw this.err.badRequest('The app is already set as public');
      }
      return this.db.updateApp({ isPublic: 1 }, id, user.email);
    })
      .then(() => new DbVendors(this.db.getConnection(), this.err))
      .then(dbVendors => dbVendors.get(appData.vendor.id));
  }

  adminListApps(offset = 0, limit = 1000) {
    return this.db.listApps(offset, limit);
  }

  listApps(vendor, user, offset = 0, limit = 1000) {
    return this.access.checkVendor(user, vendor)
      .then(() => this.db.listAppsForVendor(vendor, offset, limit));
  }

  publicListApps(offset = 0, limit = 1000) {
    const cfUri = this.env.CLOUDFRONT_URI;
    return this.db.listPublishedApps(offset, limit)
      .then(res => res.map(r => App.formatIcons(r, cfUri)));
  }

  getAppForVendor(id, vendor, user, version = null) {
    return this.access.checkApp(user, vendor, id)
      .then(() => this.db.getApp(id, version))
      .then(appData => App.formatIcons(appData, this.env.CLOUDFRONT_URI));
  }

  getAppWithVendor(id) {
    return this.db.publicGetApp(id)
      .then(data => App.formatIcons(data, this.env.CLOUDFRONT_URI));
  }

  adminGetAppWithVendor(id, version = null) {
    return this.db.getAppWithVendor(id, version)
      .then(data => App.formatIcons(data, this.env.CLOUDFRONT_URI));
  }

  deprecate(appId, vendor, user, expire = null, replace = null) {
    return this.access.checkApp(user, vendor, appId)
      .then(() => this.db.getApp(appId))
      .then((app) => {
        if (app.isDeprecated) {
          throw this.err.badRequest('The app is already set as deprecated');
        }
        if (replace) {
          return this.db.getApp(replace);
        }
      })
      .then(() => this.db.updateApp({
        isPublic: 0,
        isDeprecated: 1,
        expiredOn: expire,
        replacementApp: replace,
      }, appId, user.email))
      .then(() => null);
  }

  static formatIcons(input, cfUri) {
    const res = input;
    res.icon = {
      32: input.icon32 ? `https://${cfUri}/icons/${input.icon32}` : null,
      64: input.icon64 ? `https://${cfUri}/icons/${input.icon64}` : null,
    };
    delete res.icon32;
    delete res.icon64;
    return res;
  }
}

export default App;
