'use strict';
require('dotenv').config({path: '.env-test', silent: true});

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

  describe('format', function() {
    it ('format app input', function(done) {
      var input = {
        uiOptions: ['1', '2'],
        testConfiguration: {one: 'two'},
        configurationSchema: {three: 'four'},
        actions: ['action']
      };
      var res = db.formatAppInput(input);
      expect(res).to.have.property('uiOptions');
      expect(res).to.have.property('testConfiguration');
      expect(res).to.have.property('configurationSchema');
      expect(res).to.have.property('actions');
      expect(res.uiOptions).to.equal('["1","2"]');
      expect(res.testConfiguration).to.equal('{"one":"two"}');
      expect(res.configurationSchema).to.equal('{"three":"four"}');
      expect(res.actions).to.equal('["action"]');
      done();
    });

    it ('format app output', function(done) {
      var input = {
        encryption: 1,
        defaultBucket: 0,
        forwardToken: 1,
        uiOptions: '["1","2"]',
        testConfiguration: '{"one":"two"}',
        configurationSchema: '{"three":"four"}',
        actions: "[]",
        fees: 0,
        isApproved: 1,
        vendorId: 'keboola',
        vendorName: 'Keboola',
        vendorAddress: 'Křižíkova 115, Praha',
        vendorEmail: 'test@test.com'
      };
      var res = db.formatAppOutput(input);
      expect(res).to.have.property('encryption');
      expect(res).to.have.property('defaultBucket');
      expect(res).to.have.property('forwardToken');
      expect(res).to.have.property('uiOptions');
      expect(res).to.have.property('testConfiguration');
      expect(res).to.have.property('configurationSchema');
      expect(res).to.have.property('actions');
      expect(res).to.have.property('fees');
      expect(res).to.have.property('isApproved');
      expect(res).to.have.property('vendor');
      expect(res.vendor).to.have.property('id');
      expect(res.vendor).to.have.property('name');
      expect(res.vendor).to.have.property('address');
      expect(res.vendor).to.have.property('email');
      expect(res).to.not.have.property('vendorId');
      expect(res).to.not.have.property('vendorName');
      expect(res).to.not.have.property('vendorAddress');
      expect(res).to.not.have.property('vendorEmail');
      expect(res.encryption).to.equal(true);
      expect(res.defaultBucket).to.equal(false);
      expect(res.forwardToken).to.equal(true);
      expect(res.uiOptions).to.eql(['1', '2']);
      expect(res.testConfiguration).to.eql({one: 'two'});
      expect(res.configurationSchema).to.eql({three: 'four'});
      expect(res.actions).to.eql([]);
      expect(res.fees).to.equal(false);
      expect(res.isApproved).to.equal(true);
      expect(res.vendor.id).to.equal('keboola');
      expect(res.vendor.name).to.equal('Keboola');
      expect(res.vendor.address).to.equal('Křižíkova 115, Praha');
      expect(res.vendor.email).to.equal('test@test.com');
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
    var appId = 'a-checkAppNotExists-' + Date.now();
    var vendor = 'v-checkAppNotExists' + Date.now();

    it('app does not exist', function(done) {
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
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'], function() {
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

  describe('checkAppAccess', function() {
    var appId = 'a-checkAppAccess-' + Date.now();
    var vendor = 'v-checkAppAccess-' + Date.now();

    before(function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'], function() {
          db.connect({
            host: process.env.TEST_RDS_HOST,
            user: process.env.TEST_RDS_USER,
            password: process.env.TEST_RDS_PASSWORD,
            database: process.env.TEST_RDS_DATABASE,
            ssl: process.env.TEST_RDS_SSL
          });
          done();
        });
      });
    });

    it('has access', function(done) {
      db.checkAppAccess(appId, vendor, function (err) {
        expect(err).to.be.empty;
        done();
      });
    });

    it('does not have access', function(done) {
      var vendor2 = 'v2' + Date.now();
      db.checkAppAccess(appId, vendor2, function (err) {
        expect(err).to.be.an('error');
        done();
      });
    });
  });

  describe('insertApp', function() {
    it('insert new app', function(done) {
      var appId = 'a-insertApp-' + Date.now();
      var vendor = 'v-insertApp-' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function() {
        db.connect({
          host: process.env.TEST_RDS_HOST,
          user: process.env.TEST_RDS_USER,
          password: process.env.TEST_RDS_PASSWORD,
          database: process.env.TEST_RDS_DATABASE,
          ssl: process.env.TEST_RDS_SSL
        });
        db.insertApp({id: appId, vendor: vendor, name: 'test', type: 'extractor'}, function() {
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
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'], function(err) {
          if (err) throw err;
          db.connect({
            host: process.env.TEST_RDS_HOST,
            user: process.env.TEST_RDS_USER,
            password: process.env.TEST_RDS_PASSWORD,
            database: process.env.TEST_RDS_DATABASE,
            ssl: process.env.TEST_RDS_SSL
          });
          db.insertApp({id: appId, vendor: vendor, name: 'test', type: 'extractor'}, function() {
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
      var appId = 'a-updateApp-' + Date.now();
      var vendor = 'v-updateApp-' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test'], function(err) {
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

  describe('addAppIcon', function() {
    it('add app icon', function(done) {
      var appId = 'a-addAppIcon-' + Date.now();
      var vendor = 'v-addAppIcon' + Date.now();

      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test'], function(err) {
            if (err) throw err;
            db.connect({
              host: process.env.TEST_RDS_HOST,
              user: process.env.TEST_RDS_USER,
              password: process.env.TEST_RDS_PASSWORD,
              database: process.env.TEST_RDS_DATABASE,
              ssl: process.env.TEST_RDS_SSL
            });
            var size = 32;
            db.addAppIcon(appId, size, function() {
              rds.query('SELECT * FROM `apps` WHERE id=? AND version=2', appId, function(err, res) {
                if (err) throw err;
                expect(res).to.have.length(1);
                expect(res[0].icon32).to.equal(appId+'/'+size+'/2.png');
                rds.query('SELECT * FROM `appVersions` WHERE id=? AND version=2', appId, function(err, res) {
                  if (err) throw err;
                  expect(res).to.have.length(1);
                  expect(res[0].icon32).to.equal(appId+'/'+size+'/2.png');
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
    var appId = 'a-getApp-' + Date.now();
    var vendor = 'v-getApp-' + Date.now();
    before(function(done) {
      db.connect({
        host: process.env.TEST_RDS_HOST,
        user: process.env.TEST_RDS_USER,
        password: process.env.TEST_RDS_PASSWORD,
        database: process.env.TEST_RDS_DATABASE,
        ssl: process.env.TEST_RDS_SSL
      });
      done();
    });

    it('get non-existing app', function(done) {
      db.getApp(appId, null, function(err) {
        expect(err).to.not.be.null;
        done();
      });
    });

    it('get existing app', function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'], function(err) {
          if (err) throw err;
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
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name=?', [appId, vendor, 'test'], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=?, name=?;', [appId, 2, 'test'], function(err) {
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
    var appId = 'a-listAppsForVendor-' + Date.now();
    var vendor = 'v1-listAppsForVendor-' + Date.now();
    var vendor2 = 'v2-listAppsForVendor-' + Date.now();

    before(function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="extractor";', [appId, vendor], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor2, function(err) {
            if (err) throw err;
            rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="extractor";', ['ex-' + Date.now(), vendor2], function(err) {
              if (err) throw err;
              rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="extractor";', [appId+'1', vendor], function(err) {
                if (err) throw err;
                db.connect({
                  host: process.env.TEST_RDS_HOST,
                  user: process.env.TEST_RDS_USER,
                  password: process.env.TEST_RDS_PASSWORD,
                  database: process.env.TEST_RDS_DATABASE,
                  ssl: process.env.TEST_RDS_SSL
                });
                done();
              });
            });
          });
        });
      });
    });

    it('list all', function(done) {
      db.listAppsForVendor(vendor, null, null, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.length(2);
        expect(res[0].id).to.be.equal(appId);
        done();
      });
    });

    it('list limited', function(done) {
      db.listAppsForVendor(vendor, 1, 1, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.length(1);
        expect(res[0].id).to.be.equal(appId+'1');
        done();
      });
    });
  });

  describe('listVersions', function() {
    var appId = 'a-listVersions-' + Date.now();
    var vendor = 'v-listVersions-' + Date.now();

    before(function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, name="test", type="extractor";', [appId, vendor], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test v1'], function(err) {
            if (err) throw err;
            rds.query('INSERT INTO `appVersions` SET id=?, version=2, name=?', [appId, 'test v2'], function(err) {
              if (err) throw err;
              rds.query('INSERT INTO `appVersions` SET id=?, version=3, name=?', [appId, 'test v3'], function(err) {
                if (err) throw err;
                db.connect({
                  host: process.env.TEST_RDS_HOST,
                  user: process.env.TEST_RDS_USER,
                  password: process.env.TEST_RDS_PASSWORD,
                  database: process.env.TEST_RDS_DATABASE,
                  ssl: process.env.TEST_RDS_SSL
                });
                done();
              });
            });
          });
        });
      });
    });

    it('list all versions', function(done) {
      db.listVersions(appId, null, null, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.length(3);
        expect(res[2].name).to.be.equal('test v3');
        done();
      });
    });

    it('list limited versions', function(done) {
      db.listVersions(appId, 1, 1, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.length(1);
        expect(res[0].name).to.be.equal('test v2');
        done();
      });
    });
  });

  describe('getPublishedApp', function() {
    var appId = 'a-getPublishedApp-' + Date.now();
    var vendor = 'v-getPublishedApp-' + Date.now();

    before(function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=3, name="test", type="extractor", isApproved=1;', [appId, vendor], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test v1'], function(err) {
            if (err) throw err;
            rds.query('INSERT INTO `appVersions` SET id=?, version=2, name=?', [appId, 'test v2'], function(err) {
              if (err) throw err;
              rds.query('INSERT INTO `appVersions` SET id=?, version=3, name=?', [appId, 'test v3'], function(err) {
                if (err) throw err;
                db.connect({
                  host: process.env.TEST_RDS_HOST,
                  user: process.env.TEST_RDS_USER,
                  password: process.env.TEST_RDS_PASSWORD,
                  database: process.env.TEST_RDS_DATABASE,
                  ssl: process.env.TEST_RDS_SSL
                });
                done();
              });
            });
          });
        });
      });
    });

    it('get last version', function(done) {
      db.getPublishedApp(appId, null, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.property('version');
        expect(res.version).to.be.equal(3);
        done();
      });
    });

    it('get specific version', function(done) {
      db.getPublishedApp(appId, 1, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.property('version');
        expect(res.version).to.be.equal(1);
        done();
      });
    });

    it('do not show unpublished app', function(done) {
      var appId2 = 'app2' + Date.now();
      rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=3, name="test", type="extractor", isApproved=0;', [appId2, vendor], function(err) {
        if (err) throw err;
        db.getPublishedApp(appId2, null, function(err) {
          expect(err).to.not.be.null;
          done();
        });
      });
    });
  });

  describe('listAllPublishedApps', function() {
    var appId1 = 'a1-listAllPublishedApps-' + Date.now();
    var appId2 = 'a2-listAllPublishedApps-' + Date.now();
    var vendor = 'v-listAllPublishedApps-' + Date.now();

    before(function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=1, name="test", type="extractor", isApproved=1;', [appId1, vendor], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId1, 'test'], function(err) {
            if (err) throw err;
            rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=1, name="test", type="extractor", isApproved=1;', [appId2, vendor], function(err) {
              if (err) throw err;
              rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId2, 'test'], function(err) {
                if (err) throw err;
                db.connect({
                  host: process.env.TEST_RDS_HOST,
                  user: process.env.TEST_RDS_USER,
                  password: process.env.TEST_RDS_PASSWORD,
                  database: process.env.TEST_RDS_DATABASE,
                  ssl: process.env.TEST_RDS_SSL
                });
                done();
              });
            });
          });
        });
      });
    });

    it('list all', function(done) {
      db.listAllPublishedApps(null, null, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.length.at.least(2);
        done();
      });
    });

    it('list selected', function(done) {
      db.listAllPublishedApps(1, 1, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.lengthOf(1);
        done();
      });
    });
  });

  describe('listPublishedAppVersions', function() {
    var appId = 'a1-listPublishedAppVersions-' + Date.now();
    var vendor = 'v-listPublishedAppVersions-' + Date.now();

    before(function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `apps` SET id=?, vendor=?, version=1, name="test", type="extractor", isApproved=1;', [appId, vendor], function(err) {
          if (err) throw err;
          rds.query('INSERT INTO `appVersions` SET id=?, version=1, name=?', [appId, 'test'], function(err) {
            if (err) throw err;
            rds.query('INSERT INTO `appVersions` SET id=?, version=2, name=?', [appId, 'test2'], function(err) {
              if (err) throw err;
              db.connect({
                host: process.env.TEST_RDS_HOST,
                user: process.env.TEST_RDS_USER,
                password: process.env.TEST_RDS_PASSWORD,
                database: process.env.TEST_RDS_DATABASE,
                ssl: process.env.TEST_RDS_SSL
              });
              done();
            });
          });
        });
      });
    });

    it('list all', function(done) {
      db.listPublishedAppVersions(appId, null, null, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.lengthOf(2);
        expect(res[0].name).to.equal('test');
        expect(res[1].name).to.equal('test2');
        done();
      });
    });

    it('list selected', function(done) {
      db.listPublishedAppVersions(appId, 1, 1, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.lengthOf(1);
        expect(res[0].name).to.equal('test2');
        done();
      });
    });
  });

  describe('listVendors', function() {
    var vendor1 = 'v1-listVendors-' + Date.now();
    var vendor2 = 'v2-listVendors-' + Date.now();

    before(function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor1, function(err) {
        if (err) throw err;
        rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor2, function(err) {
          if (err) throw err;
          db.connect({
            host: process.env.TEST_RDS_HOST,
            user: process.env.TEST_RDS_USER,
            password: process.env.TEST_RDS_PASSWORD,
            database: process.env.TEST_RDS_DATABASE,
            ssl: process.env.TEST_RDS_SSL
          });
          done();
        });
      });
    });

    it('list all', function(done) {
      db.listVendors(null, null, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.length.at.least(2);
        done();
      });
    });

    it('list selected', function(done) {
      db.listVendors(1, 1, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.lengthOf(1);
        done();
      });
    });
  });

  describe('getVendor', function() {
    var vendor1 = 'v1-getVendor-' + Date.now();

    before(function(done) {
      rds.query('INSERT INTO `vendors` SET id=?, name="test", address="test", email="test";', vendor1, function(err) {
        if (err) throw err;
        db.connect({
          host: process.env.TEST_RDS_HOST,
          user: process.env.TEST_RDS_USER,
          password: process.env.TEST_RDS_PASSWORD,
          database: process.env.TEST_RDS_DATABASE,
          ssl: process.env.TEST_RDS_SSL
        });
        done();
      });
    });

    it('get', function(done) {
      db.getVendor(vendor1, function(err, res) {
        expect(err).to.be.null;
        expect(res).to.have.property('id');
        expect(res).to.have.property('name');
        expect(res).to.have.property('address');
        expect(res).to.have.property('email');
        expect(res.id).to.equal(vendor1);
        done();
      });
    });
  });
});
