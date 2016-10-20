'use strict';

const _ = require('lodash');
const async = require('async');
const mysql = require('mysql');
const error = require('./error');

let db;

const Db = module.exports;

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

Db.db = function () {
  return db;
};

Db.connect = function (params) {
  db = mysql.createConnection(params);
};

Db.end = function () {
  db.destroy();
};

Db.checkAppNotExists = function (id, callback) {
  db.query('SELECT COUNT(*) as c FROM apps WHERE id = ?', [id], (err, result) => {
    if (err) {
      return callback(err);
    }

    if (result[0].c !== 0) {
      return callback(error.badRequest('Already exists'));
    }

    return callback();
  });
};

Db.checkAppAccess = function (id, vendor, callback) {
  db.query(
    'SELECT COUNT(*) as c FROM apps WHERE id = ? AND vendor = ?',
    [id, vendor],
    (err, result) => {
      if (err) {
        return callback(err);
      }

      if (result[0].c === 0) {
        return callback(error.notFound());
      }

      return callback();
    }
  );
};

Db.insertApp = function (paramsIn, callbackMain) {
  const params = Db.formatAppInput(paramsIn);
  async.waterfall([
    function (callback) {
      db.query('INSERT INTO apps SET ?', params, err => callback(err));
    },
    function (callback) {
      delete params.vendor;
      db.query('INSERT INTO appVersions SET ?', params, err => callback(err));
    },
  ], callbackMain);
};

Db.copyAppToVersion = function (id, user, callbackMain) {
  async.waterfall([
    function (callback) {
      db.query('SELECT * FROM apps WHERE id = ?', [id], (err, res) => {
        if (err) {
          return callback(err);
        }

        const result = res;
        if (result.length === 0) {
          return callback(error.notFound(`App ${id} does not exist`));
        }

        delete result[0].vendor;
        delete result[0].isApproved;
        delete result[0].createdOn;
        delete result[0].createdBy;

        return callback(null, result[0]);
      });
    },
    function (appIn, callback) {
      const app = appIn;
      app.createdBy = user;
      db.query(
        'INSERT INTO appVersions SET ?',
        app,
        err => callback(err, app.version)
      );
    },
  ], callbackMain);
};

Db.updateApp = function (paramsIn, id, user, callbackMain) {
  const params = Db.formatAppInput(paramsIn);

  async.waterfall([
    function (callback) {
      db.query(
        'UPDATE apps SET ?, version = version + 1 WHERE id = ?',
        [params, id],
        err => callback(err)
      );
    },
    function (callback) {
      Db.copyAppToVersion(id, user, callback);
    },
  ], callbackMain);
};

Db.addAppIcon = function (id, size, callbackMain) {
  async.waterfall([
    function (callback) {
      db.query(
        'UPDATE apps ' +
        'SET ?? = CONCAT(?, version + 1, ?), version = version + 1 ' +
        'WHERE id = ?',
        [`icon${size}`, `${id}/${size}/`, '.png', id],
        err => callback(err)
      );
    },
    function (callback) {
      Db.copyAppToVersion(id, 'upload', callback);
    },
  ], callbackMain);
};

Db.getApp = function (id, version, callback) {
  async.waterfall([
    function (cb) {
      if (version) {
        db.query(
          'SELECT * FROM appVersions WHERE id = ? AND version = ?',
          [id, version],
          (err, res) => cb(err, res)
        );
      } else {
        db.query(
          'SELECT * FROM apps WHERE id = ?',
          [id],
          (err, res) => cb(err, res)
        );
      }
    },
    function (data, callbackLocal) {
      if (data.length === 0) {
        return callback(error.notFound());
      }

      return callbackLocal(null, Db.formatAppOutput(data[0]));
    },
  ], callback);
};

Db.listAppsForVendor = function (vendor, offsetIn, limitIn, callback) {
  const offset = offsetIn ? _.toSafeInteger(offsetIn) : 0;
  const limit = limitIn ? _.toSafeInteger(limitIn) : 100;
  db.query(
    'SELECT id, version, name, type, createdOn, createdBy, isApproved, ' +
    'legacyUri ' +
    'FROM apps ' +
    'WHERE vendor = ?' +
    'ORDER BY name LIMIT ? OFFSET ?;', [vendor, limit, offset], (err, res) => {
      if (err) {
        callback(err);
      }
      res.map((app) => {
        app.isApproved = app.isApproved === 1;
      });
      callback(null, res);
    });
};

Db.listVersions = function (id, offsetIn, limitIn, callback) {
  const offset = offsetIn ? _.toSafeInteger(offsetIn) : 0;
  const limit = limitIn ? _.toSafeInteger(limitIn) : 100;
  db.query(
    'SELECT * ' +
    'FROM appVersions ' +
    'WHERE id = ? ' +
    'ORDER BY createdOn LIMIT ? OFFSET ?;', [id, limit, offset], (err, res) => {
      if (err) return callback(err);
      res.map(Db.formatAppOutput);
      return callback(null, res);
    }
  );
};

Db.getPublishedApp = function (id, version, callback) {
  if (version) {
    db.query(
      'SELECT a.id, a.name, ap.vendor as vendorId, v.name as vendorName, ' +
      'v.address as vendorAddress, v.email as vendorEmail, a.version, ' +
      'a.type, a.repoType, a.repoOptions, a.repoUri, a.repoTag, ' +
      'a.shortDescription, a.longDescription, a.licenseUrl, ' +
      'a.documentationUrl, a.requiredMemory, a.processTimeout, a.encryption, ' +
      'a.defaultBucket, a.defaultBucketStage, a.forwardToken, a.uiOptions, ' +
      'a.testConfiguration, a.configurationSchema, a.emptyConfiguration, ' +
      'a.configurationDescription, a.actions, a.fees, a.limits, a.logger, ' +
      'a.loggerConfiguration, a.icon32, a.icon64, ap.legacyUri ' +
      'FROM appVersions AS a ' +
      'LEFT JOIN apps ap ON (ap.id = a.id) ' +
      'LEFT JOIN vendors v ON (ap.vendor = v.id) ' +
      'WHERE a.id=? AND a.version=? AND ap.isApproved=1;', [id, version], (err, result) => {
        if (err) return callback(err);
        if (result.length === 0) {
          return callback(error.notFound());
        }
        return callback(err, Db.formatAppOutput(result[0]));
      });
  } else {
    db.query(
      'SELECT a.id, a.name, a.vendor as vendorId, v.name as vendorName, v.address as vendorAddress, ' +
      'v.email as vendorEmail, a.version, a.type, a.repoType, a.repoOptions, a.repoUri, a.repoTag, ' +
      'a.shortDescription, a.longDescription, a.licenseUrl, a.documentationUrl, a.requiredMemory, a.processTimeout,' +
      'a.encryption, a.defaultBucket, a.defaultBucketStage, a.forwardToken, a.uiOptions, a.testConfiguration, ' +
      'a.configurationSchema, a.configurationDescription, a.emptyConfiguration, ' +
      'a.actions, a.fees, a.limits, a.logger, a.loggerConfiguration, a.icon32, a.icon64, a.legacyUri ' +
      'FROM apps AS a ' +
      'LEFT JOIN vendors v ON (a.vendor = v.id) ' +
      'WHERE a.id=? AND a.isApproved=1;', id, (err, result) => {
        if (err) return callback(err);
        if (result.length === 0) {
          return callback(error.notFound());
        }
        return callback(err, Db.formatAppOutput(result[0]));
      });
  }
};

Db.listAllPublishedApps = function (offsetIn, limitIn, callback) {
  const offset = offsetIn ? _.toSafeInteger(offsetIn) : 0;
  const limit = limitIn ? _.toSafeInteger(limitIn) : 100;
  db.query('SELECT id, vendor, name, version, type, shortDescription, icon32, icon64, legacyUri ' +
    'FROM apps ' +
    'WHERE isApproved=1 AND isVisible=1 ' +
    'ORDER BY id LIMIT ? OFFSET ?;', [limit, offset], (err, res) => {
      if (err) {
        return callback(err);
      }
      res.map(Db.formatAppOutput);
      return callback(err, res);
    });
};

Db.listPublishedAppVersions = function (id, offsetIn, limitIn, callback) {
  const offset = offsetIn ? _.toSafeInteger(offsetIn) : 0;
  const limit = limitIn ? _.toSafeInteger(limitIn) : 100;
  db.query(
    'SELECT a.id, a.name, ap.vendor as vendorId, v.name as vendorName, v.address as vendorAddress, ' +
    'v.email as vendorEmail, a.version, a.type, a.repoType, a.repoOptions, a.repoUri, a.repoTag, ' +
    'a.shortDescription, a.longDescription, a.licenseUrl, a.documentationUrl, a.requiredMemory, a.processTimeout,' +
    'a.encryption, a.defaultBucket, a.defaultBucketStage, a.forwardToken, a.uiOptions, a.testConfiguration, ' +
    'a.configurationSchema, a.configurationDescription, a.emptyConfiguration, ' +
    'a.actions, a.fees, a.limits, a.logger, a.loggerConfiguration, a.icon32, a.icon64, ap.legacyUri ' +
    'FROM appVersions a ' +
    'LEFT JOIN apps ap ON (ap.id = a.id) ' +
    'LEFT JOIN vendors v ON (ap.vendor = v.id) ' +
    'WHERE a.id=? AND ap.isApproved=1 ' +
    'ORDER BY a.createdOn LIMIT ? OFFSET ?;', [id, limit, offset], (err, res) => {
      if (err) return callback(err);
      res.map(Db.formatAppOutput);
      return callback(null, res);
    });
};

Db.listVendors = function (offsetIn, limitIn, callback) {
  const offset = offsetIn ? _.toSafeInteger(offsetIn) : 0;
  const limit = limitIn ? _.toSafeInteger(limitIn) : 100;
  db.query(
    'SELECT id, name, address, email ' +
    'FROM vendors ' +
    'ORDER BY id LIMIT ? OFFSET ?;', [limit, offset], callback);
};

Db.getVendor = function (id, callback) {
  db.query('SELECT id, name, address, email FROM vendors WHERE id = ?', [id], (err, res) => {
    if (err) {
      return callback(err);
    }
    if (res.length === 0) {
      return callback(error.notFound());
    }
    return callback(err, res[0]);
  });
};

Db.listApps = function (filter, offsetIn, limitIn, callback) {
  const offset = offsetIn ? _.toSafeInteger(offsetIn) : 0;
  const limit = limitIn ? _.toSafeInteger(limitIn) : 100;
  let filterSql = '';
  if (filter === 'unapproved') {
    filterSql = 'WHERE isApproved=0 ';
  }

  db.query(
    `SELECT id, version, name, type, createdOn, createdBy, isApproved, legacyUri
    FROM apps ${filterSql}
    ORDER BY name LIMIT ? OFFSET ?;`, [limit, offset], (err, res) => {
      if (err) {
        callback(err);
      }
      res.map((app) => {
        app.isApproved = app.isApproved === 1;
      });
      callback(null, res);
    });
};
