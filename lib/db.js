'use strict';

var mysql = require('mysql');
var db;

var formatAppOutput = function(app) {
  delete app.user_id;
  app.encryption = app.encryption == 1;
  app.default_bucket = app.default_bucket == 1;
  app.forward_token = app.forward_token == 1;
  app.ui_options = app.ui_options ? (typeof app.ui_options == 'string'
    ? JSON.parse(app.ui_options) : app.ui_options) : [];
  app.test_configuration = app.test_configuration ? (typeof app.test_configuration == 'string'
    ? JSON.parse(app.test_configuration) : app.test_configuration) : [];
  app.configuration_schema = app.configuration_schema ? (typeof app.configuration_schema == 'string'
    ? JSON.parse(app.configuration_schema) : app.configuration_schema) : [];
  app.actions = app.actions ? (typeof app.actions == 'string' ? JSON.parse(app.actions) : app.ui_options) : [];
  app.fees = app.fees == 1;
  app.is_approved = app.is_approved == 1;
  return app;
};

var formatAppInput = function (app) {
  if (app.ui_options) app.ui_options = JSON.stringify(app.ui_options);
  if (app.test_configuration) app.test_configuration = JSON.stringify(app.test_configuration);
  if (app.configuration_schema) app.configuration_schema = JSON.stringify(app.configuration_schema);
  if (app.actions) app.actions = JSON.stringify(app.actions);
  return app;
}

module.exports = {

  db: db,

  connect: function() {
    db = mysql.createConnection({
      host: process.env.RDS_HOST,
      user: process.env.RDS_USER,
      password: process.env.RDS_PASSWORD,
      database: process.env.RDS_DATABASE,
      ssl: "Amazon RDS"
    });
  },

  end: function () {
    db.destroy();
  },

  checkAppNotExists: function (id, callback) {
    db.query('SELECT * FROM `apps` WHERE `id` = ?', [id], function (err, result) {
      if (err) return callback(err);

      if (result.length != 0) {
        return callback(Error('App ' + id + ' already exists'));
      }

      return callback();
    });
  },

  insertApp: function (params, callback) {
    db.query('INSERT INTO `apps` SET ?', formatAppInput(params), function (err) {
      return callback(err);
    });
  },

  updateApp: function (params, id, callback) {
    db.query('UPDATE `apps` SET ? WHERE id = ?', [formatAppInput(params), id], function (err) {
      return callback(err);
    });
  },

  getApp: function (id, callback) {
    db.query('SELECT * FROM `apps` WHERE `id` = ?', [id], function (err, result) {
      if (err) return callback(err);

      if (result.length == 0) {
        return callback(Error('App ' + id + ' does not exist'));
      }

      return callback(null, formatAppOutput(result[0]));
    });
  },


  checkAppVersionNotExists: function (id, version, callback) {
    db.query('SELECT * FROM `app_versions` WHERE `app_id` = ? AND `version` = ?', [id, version], function (err, result) {
      if (err) return callback(err);

      if (result.length != 0) {
        return callback(Error('Version ' + version + ' of app ' + id + ' already exists'));
      }

      return callback();
    });
  },

  insertAppVersion: function (params, callback) {
    db.query('INSERT INTO `app_versions` SET ?', formatAppInput(params), function (err) {
      return callback(err);
    });
  },

  getAppVersion: function (id, version, callback) {
    db.query('SELECT * FROM `app_versions` WHERE `app_id` = ? AND `version` = ?', [id, version], function (err, result) {
      if (err) return callback(err);

      if (result.length == 0) {
        return callback(Error('Version ' + version + ' of app ' + id + ' does not exist'));
      }

      return callback(null, formatAppOutput(result[0]));
    });
  },

  listAllApprovedApps: function(callback) {
    db.query('SELECT * FROM `apps` WHERE `is_approved` = 1', function(err, result) {
      if (err) return callback(err);
      return callback(err, result.map(formatAppOutput));
    });
  },

  getVendor: function (id, callback) {
    db.query('SELECT * FROM `vendors` WHERE `id` = ?', [id], function (err, result) {
      if (err) return callback(err);

      if (result.length == 0) {
        return callback(Error('Vendor ' + id + ' does not exist'));
      }

      callback(null, result[0]);
    });
  }
};