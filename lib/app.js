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

  getIconLink(s3, id, vendor, user) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
      .then(() => {
        const getSignedUrl = Promise.promisify(s3.getSignedUrl.bind(s3));
        const validity = 3600;
        return getSignedUrl('putObject', {
          Bucket: this.env.S3_BUCKET,
          Key: `icons/${id}/upload.png`,
          Expires: validity,
          ContentType: 'image/png',
          ACL: 'public-read',
        })
          .then(res => ({
            link: res,
            expiresIn: validity,
          }));
      });
  }

  uploadIcon(s3, jimp, id, bucket, sourceKey) {
    let version;
    return s3.copyObject({
      CopySource: `${bucket}/${sourceKey}`,
      Bucket: bucket,
      Key: `icons/${id}/latest.png`,
      ACL: 'public-read',
    }).promise()
      .then(() => s3.deleteObject(
        {
          Bucket: bucket,
          Key: sourceKey,
        }
      ).promise())
      .then(() => this.db.addAppIcon(id))
      .then((v) => {
        version = v;
      })
      .then(() => s3.getObject({
        Bucket: bucket,
        Key: `icons/${id}/latest.png`,
      }).promise())
      .then(data => jimp.read(data.Body))
      .then(image => new Promise((res, rej) => {
        image.resize(64, 64).getBuffer(jimp.MIME_PNG, (err, data) => {
          if (err) {
            rej(err);
          }
          res(data);
        });
      }))
      .then(buffer => s3.putObject({
        Body: buffer,
        Bucket: bucket,
        ContentType: 'image/png',
        Key: `icons/${id}/64/${version}.png`,
        ACL: 'public-read',
      }).promise())
      .then(() => s3.getObject({
        Bucket: bucket,
        Key: `icons/${id}/latest.png`,
      }).promise())
      .then(data => jimp.read(data.Body))
      .then(image => new Promise((res, rej) => {
        image.resize(32, 32).getBuffer(jimp.MIME_PNG, (err, data) => {
          if (err) {
            rej(err);
          }
          res(data);
        });
      }))
      .then(buffer => s3.putObject({
        Body: buffer,
        Bucket: bucket,
        ContentType: 'image/png',
        Key: `icons/${id}/32/${version}.png`,
        ACL: 'public-read',
      }).promise());
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

  makeUserAdmin(cognito, email) {
    return cognito.adminGetUser({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
    }).promise()
      .then(data => this.Identity.formatUser(data))
      .then((user) => {
        if (user.isAdmin) {
          throw this.err.badRequest('The user has been already made admin');
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

  addUserToVendor(cognito, email, vendor) {
    return this.db.checkVendorExists(vendor)
      .then(() => cognito.adminGetUser({
        UserPoolId: this.env.COGNITO_POOL_ID,
        Username: email,
      }).promise())
      .then(data => this.Identity.formatUser(data))
      .then((user) => {
        if (user.vendors.indexOf(vendor) !== -1) {
          throw this.err.badRequest(`User ${email} is already member of vendor ${vendor}`);
        }
        user.vendors.push(vendor);
        return cognito.adminUpdateUserAttributes({
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

  enableUser(cognito, email) {
    return cognito.adminGetUser({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
    }).promise()
    .then((data) => {
      if (data.Enabled) {
        throw this.err.notFound('The user has been already enabled');
      }
    })
    .then(() => cognito.adminEnableUser({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
    }).promise());
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
