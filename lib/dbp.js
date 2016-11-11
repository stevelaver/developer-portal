'use strict';

const _ = require('lodash');
const mysql = require('mysql');
const Promise = require('bluebird');
const error = require('./error');

Promise.promisifyAll(mysql);
Promise.promisifyAll(require('mysql/lib/Connection').prototype);

let db;

const Db = module.exports;

Db.connect = (env) => {
  db = mysql.createConnection({
    host: env.RDS_HOST,
    user: env.RDS_USER,
    password: env.RDS_PASSWORD,
    database: env.RDS_DATABASE,
    ssl: env.RDS_SSL,
    port: env.RDS_PORT,
  });
};

Db.checkAppNotExists = (id) => {
  db.queryAsync('SELECT COUNT(*) as c FROM apps WHERE id = ?', [id])
  .spread(res => new Promise((resolve, reject) => {
    if (res.c !== 0) {
      reject(error.badRequest('Already exists'));
    }
    resolve();
  }));
};

Db.checkAppAccess = (id, vendor) => {
  db.queryAsync(
    'SELECT COUNT(*) as c FROM apps WHERE id = ? AND vendor = ?',
    [id, vendor]
  )
  .spread(res => new Promise((resolve, reject) => {
    if (res.c === 0) {
      reject(error.notFound());
    }
    resolve();
  }));
};

Db.insertApp = (paramsIn) => {
  const params = Db.formatAppInput(paramsIn);
  return db.queryAsync('INSERT INTO apps SET ?', params)
  .then(() => {
    delete params.vendor;
    return db.queryAsync('INSERT INTO appVersions SET ?', params);
  });
};

Db.copyAppToVersion = function (id, user) {
  return db.queryAsync('SELECT * FROM apps WHERE id = ?', [id])
  .spread(res => new Promise((resolve, reject) => {
    const result = res;
    if (result.length === 0) {
      reject(error.notFound(`App ${id} does not exist`));
    } else {
      delete result.vendor;
      delete result.isApproved;
      delete result.createdOn;
      delete result.createdBy;
      resolve(result);
    }
  }))
  .then((appIn) => {
    const app = appIn;
    app.createdBy = user;
    return db.queryAsync('INSERT INTO appVersions SET ?', app);
  });
};

Db.updateApp = function (paramsIn, id, user) {
  const params = Db.formatAppInput(paramsIn);
  return db.queryAsync(
    'UPDATE apps SET ?, version = version + 1 WHERE id = ?',
    [params, id]
  )
  .then(() => Db.copyAppToVersion(id, user));
};

Db.getApp = function (id, version = null) {
  let query;
  let params;
  if (version) {
    query = 'SELECT * FROM appVersions WHERE id = ? AND version = ?';
    params = [id, version];
  } else {
    query = 'SELECT * FROM apps WHERE id = ?';
    params = [id];
  }

  return db.queryAsync(query, params)
  .spread(res => new Promise((resolve, reject) => {
    if (!res) {
      reject(error.notFound());
    }
    resolve(Db.formatAppOutput(res));
  }));
};

Db.end = () => db.end();

Db.formatAppInput = function (appIn) {
  const app = appIn;
  if (app.uiOptions) {
    app.uiOptions = JSON.stringify(app.uiOptions);
  }
  if (app.testConfiguration) {
    app.testConfiguration = JSON.stringify(app.testConfiguration);
  }
  if (app.configurationSchema) {
    app.configurationSchema = JSON.stringify(app.configurationSchema);
  }
  if (app.actions) {
    app.actions = JSON.stringify(app.actions);
  }
  if (app.emptyConfiguration) {
    app.emptyConfiguration = JSON.stringify(app.emptyConfiguration);
  }
  if (app.loggerConfiguration) {
    app.loggerConfiguration = JSON.stringify(app.loggerConfiguration);
  }

  if (_.has(app, 'repository.type')) {
    app.repoType = _.get(app, 'repository.type');
  }
  if (_.has(app, 'repository.uri')) {
    app.repoUri = _.get(app, 'repository.uri');
  }
  if (_.has(app, 'repository.tag')) {
    app.repoTag = _.get(app, 'repository.tag');
  }
  if (_.has(app, 'repository.options')) {
    app.repoOptions = app.repository.options
      ? JSON.stringify(app.repository.options) : null;
  }
  delete app.repository;

  const allowedKeys = ['id', 'vendor', 'isApproved', 'isVisible', 'createdOn',
    'createdBy', 'version', 'name', 'type', 'repoType', 'repoUri', 'repoTag',
    'repoOptions', 'shortDescription', 'longDescription', 'licenseUrl',
    'documentationUrl', 'requiredMemory', 'processTimeout', 'encryption',
    'defaultBucket', 'defaultBucketStage', 'forwardToken', 'uiOptions',
    'testConfiguration', 'configurationSchema', 'configurationDescription',
    'emptyConfiguration', 'actions', 'fees', 'limits', 'logger',
    'loggerConfiguration', 'icon32', 'icon64', 'legacyUri'];
  _.each(app, (val, key) => {
    if (!_.includes(allowedKeys, key)) {
      delete app[key];
    }
  });

  return app;
};

Db.formatAppOutput = function (appIn) {
  const app = appIn;
  app.uri = _.get(app, 'legacyUri', null) ?
    app.legacyUri : `https://syrup.keboola.com/docker/${app.id}`;
  delete app.legacyUri;

  if (_.has(app, 'encryption')) {
    app.encryption = app.encryption === 1;
  }
  if (_.has(app, 'isVisible')) {
    app.isVisible = app.isVisible === 1;
  }
  if (_.has(app, 'defaultBucket')) {
    app.defaultBucket = app.defaultBucket === 1;
  }
  if (_.has(app, 'forwardToken')) {
    app.forwardToken = app.forwardToken === 1;
  }
  if (_.has(app, 'uiOptions')) {
    app.uiOptions = typeof app.uiOptions === 'string'
      ? JSON.parse(app.uiOptions) : app.uiOptions;
    if (!app.uiOptions) {
      app.uiOptions = [];
    }
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
  if (_.has(app, 'isApproved')) {
    app.isApproved = app.isApproved === 1;
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
  return app;
};
