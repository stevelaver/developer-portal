'use strict';
require('dotenv').config({path: '.env-test'});

var async = require('async');
var db = require('../../lib/db');
var execsql = require('../../lib/execsql');
var expect = require('chai').expect;
var mysql = require('mysql');
var rds;

describe('db', function() {
  before(function(done) {
    rds = mysql.createConnection({
      host: process.env.TEST_RDS_HOST,
      user: process.env.TEST_RDS_USER,
      password: process.env.TEST_RDS_PASSWORD,
      database: process.env.TEST_RDS_DATABASE,
      ssl: process.env.TEST_RDS_SSL ? 'Amazon RDS' : false,
      multipleStatements: true
    });
    execsql.execFile(rds, __dirname + '/../../rds-model.sql', function(err) {
      if (err) throw err;
      done();
    });
  });

  describe('init', function() {
    it('db not connected', function(done) {
      expect(db.db()).to.be.undefined;
      done();
    });

    it('db is connected', function(done) {
      db.connect({
        host: process.env.TEST_RDS_HOST,
        user: process.env.TEST_RDS_USER,
        password: process.env.TEST_RDS_PASSWORD,
        database: process.env.TEST_RDS_DATABASE,
        ssl: process.env.TEST_RDS_SSL
      });
      expect(db.db()).to.be.a('object');
      done();
    });

    it('db is disconnected', function(done) {
      db.connect({
        host: process.env.TEST_RDS_HOST,
        user: process.env.TEST_RDS_USER,
        password: process.env.TEST_RDS_PASSWORD,
        database: process.env.TEST_RDS_DATABASE,
        ssl: process.env.TEST_RDS_SSL
      });
      db.db().query('SELECT 1', function(err) {
        if (err) throw err;

        expect(db.db().state).to.equal('authenticated');
        db.end();
        expect(db.db().state).to.equal('disconnected');
        done();
      });
    });
  });

  describe('checkAppNotExists', function() {
    it('app does not exist', function(done) {
      var appId = 'ex-' + Date.now();

      db.connect({
        host: process.env.TEST_RDS_HOST,
        user: process.env.TEST_RDS_USER,
        password: process.env.TEST_RDS_PASSWORD,
        database: process.env.TEST_RDS_DATABASE,
        ssl: process.env.TEST_RDS_SSL
      });
      db.checkAppNotExists(appId, function(err) {
        expect(err).to.be.undefined;
        done();
      })
    });

    it('app exists', function (done) {
      var appId = 'ex-' + Date.now();
      var vendor = 'v' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?', [appId, vendor], function() {
          db.connect({
            host: process.env.TEST_RDS_HOST,
            user: process.env.TEST_RDS_USER,
            password: process.env.TEST_RDS_PASSWORD,
            database: process.env.TEST_RDS_DATABASE,
            ssl: process.env.TEST_RDS_SSL
          });
          expect(function () {
            db.checkAppNotExists(appId, function () {
            });
          }).to.throw(function () {
            done();
          });
        });
      });
    });
  });

  describe('insertApp', function() {
    it('insert new app', function(done) {
      var appId = 'ex-' + Date.now();
      var vendor = 'v' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function() {
        db.connect({
          host: process.env.TEST_RDS_HOST,
          user: process.env.TEST_RDS_USER,
          password: process.env.TEST_RDS_PASSWORD,
          database: process.env.TEST_RDS_DATABASE,
          ssl: process.env.TEST_RDS_SSL
        });
        db.insertApp({id: appId, vendor: vendor, name: 'test', type: 'reader'}, function() {
          rds.query('SELECT * FROM `apps` WHERE id=?', appId, function (err, res) {
            expect(res).to.have.length(1);
            rds.query('SELECT * FROM `appVersions` WHERE id=?', appId, function (err, res) {
              expect(res).to.have.length(1);
              expect(res[0].version).to.equal(1);
              done();
            });
          });
        });
      });
    });

    it('insert already existing app', function(done) {
      var appId = 'ex-' + Date.now();
      var vendor = 'v' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?', [appId, vendor], function(err) {
          if (err) throw err;
          db.connect({
            host: process.env.TEST_RDS_HOST,
            user: process.env.TEST_RDS_USER,
            password: process.env.TEST_RDS_PASSWORD,
            database: process.env.TEST_RDS_DATABASE,
            ssl: process.env.TEST_RDS_SSL
          });
          db.insertApp({id: appId, vendor: vendor, name: 'test', type: 'reader'}, function() {
            expect(function() {
              rds.query('SELECT * FROM `apps` WHERE id=?', appId, function() {});
            }).to.throw(function() {
              done();
            });
          })
        })
      });
    });
  });

  describe('updateApp', function() {
    it('update existing app', function(done) {
      var appId = 'ex-' + Date.now();
      var vendor = 'v' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?', [appId, vendor], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1', [appId], function(err) {
            if (err) throw err;
            db.connect({
              host: process.env.TEST_RDS_HOST,
              user: process.env.TEST_RDS_USER,
              password: process.env.TEST_RDS_PASSWORD,
              database: process.env.TEST_RDS_DATABASE,
              ssl: process.env.TEST_RDS_SSL
            });
            db.updateApp({name: 'New name'}, appId, 'user', function() {
              rds.query('SELECT * FROM `apps` WHERE id=? AND version=2', appId, function(err, res) {
                if (err) throw err;
                expect(res).to.have.length(1);
                rds.query('SELECT * FROM `appVersions` WHERE id=? AND version=2', appId, function(err, res) {
                  if (err) throw err;
                  expect(res).to.have.length(1);
                  expect(res[0].name).to.equal('New name');
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('getApp', function() {
    it('get non-existing app', function(done) {
      var appId = 'ex-' + Date.now();

      db.connect({
        host: process.env.TEST_RDS_HOST,
        user: process.env.TEST_RDS_USER,
        password: process.env.TEST_RDS_PASSWORD,
        database: process.env.TEST_RDS_DATABASE,
        ssl: process.env.TEST_RDS_SSL
      });
      db.getApp(appId, null, function(err) {
        expect(err).to.not.be.null;
        done();
      });
    });

    it('get existing app', function(done) {
      var appId = 'ex-' + Date.now();
      var vendor = 'v' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?;', [appId, vendor], function(err) {
          if (err) throw err;
          db.connect({
            host: process.env.TEST_RDS_HOST,
            user: process.env.TEST_RDS_USER,
            password: process.env.TEST_RDS_PASSWORD,
            database: process.env.TEST_RDS_DATABASE,
            ssl: process.env.TEST_RDS_SSL
          });
          db.getApp(appId, null, function(err, res) {
            expect(err).to.be.null;
            expect(res).to.have.property('id');
            expect(res.id).to.be.equal(appId);
            done();
          })
        })
      });
    });

    it('get app version', function(done) {
      var appId = 'ex-' + Date.now();
      var vendor = 'v' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?;', [appId, vendor], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=?;', [appId, 2], function(err) {
            if (err) throw err;
            db.connect({
              host: process.env.TEST_RDS_HOST,
              user: process.env.TEST_RDS_USER,
              password: process.env.TEST_RDS_PASSWORD,
              database: process.env.TEST_RDS_DATABASE,
              ssl: process.env.TEST_RDS_SSL
            });
            db.getApp(appId, 2, function(err, res) {
              expect(err).to.be.null;
              expect(res).to.have.property('id');
              expect(res.id).to.be.equal(appId);
              done();
            });
          });
        });
      });
    });
  });

  describe('listAppsForVendor', function() {
    it('list', function(done) {
      var appId = 'ex-' + Date.now();
      var vendor = 'v1' + Date.now();
      var vendor2 = 'v2' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="reader";', [appId, vendor], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor2, function(err) {
            if (err) throw err;
            rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="reader";', ['ex-' + Date.now(), vendor2], function(err) {
              if (err) throw err;
              db.connect({
                host: process.env.TEST_RDS_HOST,
                user: process.env.TEST_RDS_USER,
                password: process.env.TEST_RDS_PASSWORD,
                database: process.env.TEST_RDS_DATABASE,
                ssl: process.env.TEST_RDS_SSL
              });
              db.listAppsForVendor(vendor, 0, 100, function(err, res) {
                expect(err).to.be.null;
                expect(res).to.have.length(1);
                expect(res[0].id).to.be.equal(appId);
                done();
              });
            });
          });
        });
      });
    });
  });
});
