'use strict';

const _ = require('lodash');
const mysql = require('mysql');
const Promise = require('bluebird');
const error = require('./error');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

let db;

const Db = module.exports;

const defaultLimit = 1000;

Db.init = (dbc) => {
  db = dbc;
  return db.connectAsync();
};

Db.connect = env =>
  Db.init(mysql.createConnection({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
    // debug: ['ComQueryPacket'],
  }))
;

Db.getConnection = () => db;

Db.checkAppNotExists = id =>
  db.queryAsync('SELECT COUNT(*) as c FROM apps WHERE id = ?', [id])
    .spread((res) => {
      if (res.c !== 0) {
        throw error.badRequest('Already exists');
      }
    })
    .then(() => true);

Db.checkAppAccess = (id, vendor) =>
  db.queryAsync('SELECT COUNT(*) as c FROM apps WHERE id = ? AND vendor = ?', [id, vendor])
    .spread((res) => {
      if (res.c === 0) {
        throw error.notFound();
      }
    })
    .then(() => true);

Db.checkAppExists = id =>
  db.queryAsync('SELECT COUNT(*) as c FROM apps WHERE id = ?', [id])
    .spread((res) => {
      if (res.c === 0) {
        throw error.notFound();
      }
    })
    .then(() => true);

Db.checkVendorExists = vendor =>
  db.queryAsync('SELECT COUNT(*) as c FROM vendors WHERE id = ?', [vendor])
    .spread((res) => {
      if (res.c === 0) {
        throw error.badRequest(`Vendor ${vendor} does not exist`);
      }
    })
    .then(() => true);

Db.checkVendorNotExists = vendor =>
  db.queryAsync('SELECT COUNT(*) as c FROM vendors WHERE id = ?', [vendor])
    .spread((res) => {
      if (res.c !== 0) {
        throw error.badRequest(`Vendor ${vendor} already exists`);
      }
    })
    .then(() => true);

Db.getAppsMainSql = () => 'SELECT a.*, a.vendor as vendorId, v.name as vendorName, ' +
  'v.address as vendorAddress, v.email as vendorEmail ' +
  'FROM apps a ' +
  'LEFT JOIN vendors v ON (a.vendor = v.id) ';

Db.listApps = (vendor = null, forPublic = false, offset = 0, limit = defaultLimit) => {
  let query = `${Db.getAppsMainSql()} WHERE a.deletedOn IS NULL `;
  const params = [];
  if (vendor) {
    query += 'AND a.vendor=? ';
    params.push(vendor);
  }
  if (forPublic) {
    query += 'AND a.isPublic=1 ';
  }
  query += 'ORDER BY name LIMIT ? OFFSET ?';
  params.push(limit ? _.toSafeInteger(limit) : defaultLimit);
  params.push(_.toSafeInteger(offset));
  return db.queryAsync(query, params)
    .then(res => res.map((appIn) => {
      let app = Db.formatAppOutput(appIn);
      if (forPublic) {
        app = Db.formatAppOutputForPublic(app);
      }
      return app;
    }));
};


Db.getApp = (id, version = null) => {
  if (version) {
    return Db.getAppVersion(id, version);
  }

  return db.queryAsync(`${Db.getAppsMainSql()} WHERE a.id=?`, [id])
    .spread((res) => {
      if (!res) {
        if (version) {
          throw error.notFound(`Version ${version} of app ${id} does not exist`);
        }
        throw error.notFound(`App ${id} does not exist`);
      }
      return Db.formatAppOutput(res);
    });
};

Db.getAppVersion = (id, version) =>
  db.queryAsync(
    'SELECT a.*, ' +
    'ap.vendor as vendorId, v.name as vendorName, v.address as vendorAddress, v.email as vendorEmail ' +
    'FROM appVersions a ' +
    'LEFT JOIN apps ap ON (ap.id = a.id) ' +
    'LEFT JOIN vendors v ON (ap.vendor = v.id) ' +
    'WHERE a.id = ? AND a.version = ?',
    [id, version],
  )
    .spread((res) => {
      if (!res) {
        throw error.notFound();
      }
      return Db.formatAppOutput(res);
    })
;

Db.getAppWithVendor = function (id, version = null) {
  let sql;
  let params;
  if (version) {
    sql = 'SELECT a.id, ' +
      'ap.vendor as vendorId, v.name as vendorName, v.address as vendorAddress, v.email as vendorEmail, ' +
      'a.isPublic, a.createdOn, a.createdBy, a.deletedOn, ' +
      'a.isDeprecated, a.expiredOn, a.replacementApp, ' +
      'a.version, a.name, a.type, ' +
      'a.repoType, a.repoUri, a.repoTag, a.repoOptions, ' +
      'a.shortDescription, a.longDescription, a.licenseUrl, a.documentationUrl, ' +
      'a.requiredMemory, a.processTimeout, a.encryption, a.network, a.defaultBucket, a.defaultBucketStage, ' +
      'a.forwardToken, a.forwardTokenDetails, a.injectEnvironment, a.cpuShares, ' +
      'a.uiOptions, a.imageParameters, a.testConfiguration, a.configurationSchema, a.configurationDescription, ' +
      'a.configurationFormat, a.emptyConfiguration, a.actions, a.fees, a.limits, a.logger, a.loggerConfiguration, ' +
      'a.stagingStorageInput, a.icon32, a.icon64, a.legacyUri, a.permissions, ' +
      'a.publishRequestOn, a.publishRequestBy, a.publishRequestRejectionReason ' +
      'FROM appVersions AS a ' +
      'LEFT JOIN apps ap ON (ap.id = a.id) ' +
      'LEFT JOIN vendors v ON (ap.vendor = v.id) ' +
      'WHERE a.id=? AND a.version=?';
    params = [id, version];
  } else {
    sql = 'SELECT a.id, ' +
      'a.vendor as vendorId, v.name as vendorName, v.address as vendorAddress, v.email as vendorEmail, ' +
      'a.isPublic, a.createdOn, a.createdBy, a.deletedOn, ' +
      'a.isDeprecated, a.expiredOn, a.replacementApp, ' +
      'a.version, a.name, a.type, ' +
      'a.repoType, a.repoUri, a.repoTag, a.repoOptions, ' +
      'a.shortDescription, a.longDescription, a.licenseUrl, a.documentationUrl, ' +
      'a.requiredMemory, a.processTimeout, a.encryption, a.network, a.defaultBucket, a.defaultBucketStage, ' +
      'a.forwardToken, a.forwardTokenDetails, a.injectEnvironment, a.cpuShares, ' +
      'a.uiOptions, a.imageParameters, a.testConfiguration, a.configurationSchema, a.configurationDescription, ' +
      'a.configurationFormat, a.emptyConfiguration, a.actions, a.fees, a.limits, a.logger, a.loggerConfiguration, ' +
      'a.stagingStorageInput, a.icon32, a.icon64, a.legacyUri, a.permissions, ' +
      'a.publishRequestOn, a.publishRequestBy, a.publishRequestRejectionReason ' +
      'FROM apps AS a ' +
      'LEFT JOIN vendors v ON (a.vendor = v.id) ' +
      'WHERE a.id=?';
    params = [id];
  }

  return db.queryAsync(sql, params).spread((res) => {
    if (!res) {
      throw error.notFound(`App ${id} does not exist`);
    }
    return Db.formatAppOutput(res);
  });
};

Db.publicGetApp = id =>
  Db.getAppWithVendor(id)
    .then(data => Db.formatAppOutputForPublic(data))
;

Db.listVersions = (id, offset = 0, limit = defaultLimit) =>
  db.queryAsync(
    'SELECT a.*, ap.vendor as vendorId, v.name as vendorName, v.address as vendorAddress, v.email as vendorEmail ' +
    'FROM appVersions a ' +
    'LEFT JOIN apps ap ON (ap.id = a.id) ' +
    'LEFT JOIN vendors v ON (ap.vendor = v.id) ' +
    'WHERE a.id = ? ' +
    'ORDER BY a.createdOn LIMIT ? OFFSET ?',
    [id, limit ? _.toSafeInteger(limit) : defaultLimit, _.toSafeInteger(offset)]
  )
    .then((res) => {
      res.map(Db.formatAppOutput);
      return res;
    });

Db.getLatestVersions = (since = null, until = null) => {
  const params = [];
  let query = 'SELECT * FROM appVersions WHERE createdOn >= ';
  if (since) {
    query += '? ';
    params.push(since);
  } else {
    query += 'SUBDATE(CURRENT_DATE, 1) ';
  }
  if (until) {
    query += 'AND createdOn <= ? ';
    params.push(until);
  }
  query += 'ORDER BY createdOn DESC';
  return db.queryAsync(query, params);
};

Db.listStacks = () =>
  db.queryAsync(
    'SELECT name ' +
    'FROM stacks ' +
    'ORDER BY name'
  ).then(res => res.map(r => r.name));


Db.end = () => db.endAsync()
  .catch(() => null);

Db.formatAppOutput = (appIn) => {
  const app = appIn;
  app.uri = _.get(app, 'legacyUri', null) ?
    app.legacyUri : `docker/${app.id}`;
  delete app.legacyUri;

  if (_.has(app, 'encryption')) {
    app.encryption = app.encryption === 1;
  }
  if (_.has(app, 'isPublic')) {
    app.isPublic = app.isPublic === 1;
  }
  if (_.has(app, 'isDeprecated')) {
    app.isDeprecated = app.isDeprecated === 1;
  }
  if (_.has(app, 'defaultBucket')) {
    app.defaultBucket = app.defaultBucket === 1;
  }
  if (_.has(app, 'forwardToken')) {
    app.forwardToken = app.forwardToken === 1;
  }
  if (_.has(app, 'forwardTokenDetails')) {
    app.forwardTokenDetails = app.forwardTokenDetails === 1;
  }
  if (_.has(app, 'injectEnvironment')) {
    app.injectEnvironment = app.injectEnvironment === 1;
  }
  if (_.has(app, 'uiOptions')) {
    app.uiOptions = typeof app.uiOptions === 'string'
      ? JSON.parse(app.uiOptions) : app.uiOptions;
    if (!app.uiOptions) {
      app.uiOptions = [];
    }
  }
  if (_.has(app, 'imageParameters')) {
    app.imageParameters = typeof app.imageParameters === 'string'
      ? JSON.parse(app.imageParameters) : app.imageParameters;
  }
  if (_.has(app, 'testConfiguration')) {
    app.testConfiguration = typeof app.testConfiguration === 'string'
      ? JSON.parse(app.testConfiguration) : app.testConfiguration;
  }
  if (_.has(app, 'configurationSchema')) {
    app.configurationSchema = typeof app.configurationSchema === 'string'
      ? JSON.parse(app.configurationSchema) : app.configurationSchema;
  }
  if (_.has(app, 'emptyConfiguration')) {
    app.emptyConfiguration = typeof app.emptyConfiguration === 'string'
      ? JSON.parse(app.emptyConfiguration) : app.emptyConfiguration;
  }
  if (_.has(app, 'loggerConfiguration')) {
    app.loggerConfiguration = typeof app.loggerConfiguration === 'string'
      ? JSON.parse(app.loggerConfiguration) : app.loggerConfiguration;
  }
  if (_.has(app, 'permissions')) {
    app.permissions = typeof app.permissions === 'string'
      ? JSON.parse(app.permissions) : app.permissions;
    if (!app.permissions) {
      app.permissions = [];
    }
  }
  if (_.has(app, 'actions')) {
    app.actions = typeof app.actions === 'string'
      ? JSON.parse(app.actions) : app.actions;
    if (!app.actions) {
      app.actions = [];
    }
  }
  if (_.has(app, 'fees')) {
    app.fees = app.fees === 1;
  }
  if (_.has(app, 'vendorId') && _.has(app, 'vendorName')
    && _.has(app, 'vendorAddress') && _.has(app, 'vendorEmail')) {
    app.vendor = {
      id: app.vendorId,
      name: app.vendorName,
      address: app.vendorAddress,
      email: app.vendorEmail,
    };
    delete app.vendorId;
    delete app.vendorName;
    delete app.vendorAddress;
    delete app.vendorEmail;
  }
  if (_.has(app, 'repoType')) {
    app.repository = {
      type: _.get(app, 'repoType'),
      uri: _.get(app, 'repoUri'),
      tag: _.get(app, 'repoTag'),
      options: app.repoOptions ? JSON.parse(app.repoOptions) : {},
    };
    delete app.repoType;
    delete app.repoUri;
    delete app.repoTag;
    delete app.repoOptions;
  }
  if (_.has(app, 'publishRequestOn')) {
    app.publishingRequest = (app.publishRequestBy || app.publishRequestOn || app.publishRequestRejectionReason) ? {
      createdBy: _.get(app, 'publishRequestBy'),
      createdOn: _.get(app, 'publishRequestOn'),
      rejectionReason: _.get(app, 'publishRequestRejectionReason'),
    } : null;
    delete app.publishRequestBy;
    delete app.publishRequestOn;
    delete app.publishRequestRejectionReason;
  }
  return app;
};

Db.formatAppOutputForPublic = (appIn) => {
  if (!appIn.isPublic) {
    throw error.notFound(`App ${appIn.id} does not exist`);
  }
  const app = appIn;
  delete app.createdOn;
  delete app.createdBy;
  delete app.deletedOn;
  delete app.permissions;
  delete app.publishingRequest;
  return app;
};
