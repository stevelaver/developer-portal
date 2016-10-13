'use script';

require('dotenv').config({path: '.env-test', silent: true});
const _ = require('lodash');
const async = require('async');
const db = require('../lib/db');
const fs = require('fs');
const mysql = require('mysql');
const request = require('request');

const rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST,
  user: process.env.FUNC_RDS_USER,
  password: process.env.FUNC_RDS_PASSWORD,
  database: process.env.FUNC_RDS_DATABASE,
  ssl: process.env.RDS_SSL ? 'Amazon RDS' : false,
  multipleStatements: true,
});

const args = process.argv.slice(2);

const downloadIcon = function(uri, id, size, callback) {
  if (!fs.existsSync(`icons/${id}`)) {
    fs.mkdirSync(`icons/${id}`);
  }
  if (!fs.existsSync(`icons/${id}/${size}`)) {
    fs.mkdirSync(`icons/${id}/${size}`);
  }
  request({ uri: uri })
    .pipe(fs.createWriteStream(`icons/${id}/${size}/1.png`))
    .on('close', () => callback())
    .on('error', err => console.log(err));
};

const downloadIcons = function() {
  fs.readFile(args[0], 'utf8', (err, data) => {
    if (err) throw err;
    data = JSON.parse(data);
    data.apis.forEach((app) => {
      if (app.ico32) {
        downloadIcon(app.ico32, app.id, 32, () => {
          //
        });
      } else {
        console.log(app.id, '32px Icon Missing');
      }
      if (app.ico64) {
        downloadIcon(app.ico64, app.id, 64, () => {
          //
        });
      } else {
        console.log(app.id, '64px Icon Missing');
      }
    });
  });
};

let flags = [];
const types = [];

const getData = function (callbackMain) {
  fs.readFile(args[0], 'utf8', (err, data) => {
    const result = [];
    if (err) throw err;
    data = JSON.parse(data);
    async.each(data.apis, (app, callback) => {
      if (_.has(app, 'data.vendor.contact')) {
        if (_.startsWith(app.data.vendor.contact[0], 'Blue Sky')) {
          app.vendor = 'blueskydigital';
        } else if (_.startsWith(app.data.vendor.contact[0], 'S&G Consulting')) {
          app.vendor = 'sgconsulting';
        } else if (_.startsWith(app.data.vendor.contact[0], 'CleverAnalytics')) {
          app.vendor = 'cleveranalytics';
        } else if (_.startsWith(app.data.vendor.contact[0], 'DataBreakers')) {
          app.vendor = 'databreakers';
        } else if (_.startsWith(app.data.vendor.contact[0], 'datamind')) {
          app.vendor = 'datamind';
        } else if (_.startsWith(app.data.vendor.contact[0], 'Sun Marketing')) {
          app.vendor = 'sun';
        } else if (_.startsWith(app.data.vendor.contact[0], 'aLook')) {
          app.vendor = 'alook';
        } else if (_.startsWith(app.data.vendor.contact[0], 'Ecommerce')) {
          app.vendor = 'ech';
        } else if (_.startsWith(app.data.vendor.contact[0], 'David Esner')) {
          app.vendor = 'esnerda';
        } else if (_.startsWith(app.data.vendor.contact[0], 'Medio')) {
          app.vendor = 'medio';
        } else if (_.startsWith(app.data.vendor.contact[0], 'Keboola Singapore')) {
          app.vendor = 'keboolasg';
        } else if (_.startsWith(app.data.vendor.contact[0], 'BizzTreat')) {
          app.vendor = 'bizztreat';
        } else if (_.startsWith(app.data.vendor.contact[0], 'GENEEA')) {
          app.vendor = 'geneea';
        } else if (_.startsWith(app.data.vendor.contact[0], 'HTNS')) {
          app.vendor = 'htns';
        } else if (_.startsWith(app.data.vendor.contact[0], 'Recombee')) {
          app.vendor = 'recombee';
        } else if (_.startsWith(app.data.vendor.contact[0], 'Vojtech Kurka')) {
          app.vendor = 'vokurka';
        } else if (_.startsWith(app.data.vendor.contact[0], 'Sormen Solutions')) {
          app.vendor = 'sormensolutions';
        } else if (_.startsWith(app.data.vendor.contact[0], 'StartupMetrics')) {
          app.vendor = 'startupmetrics';
        } else if (_.startsWith(app.data.vendor.contact[0], 'Tomáš Trnka')) {
          app.vendor = 'tomastrnka';
        } else if (_.startsWith(app.id, 'keboola.')) {
          app.vendor = 'keboola';
        } else {
          app.vendor = '-unknown-';
        }
      } else {
        if (_.startsWith(app.id, 'keboola.') || _.startsWith(app.id, 'ex-') || _.startsWith(app.id, 'wr-') || _.startsWith(app.id, 'ag-')
          || _.startsWith(app.id, 'orchestrator') || _.startsWith(app.id, 'pigeon') || _.startsWith(app.id, 'transformation')
          || _.startsWith(app.id, 'docker') || _.startsWith(app.id, 'dca') || _.startsWith(app.id, 'rcp')
          || _.startsWith(app.id, 'kbc-') || _.startsWith(app.id, 'lg-') || _.startsWith(app.id, 'rt-')
          || _.includes(['gooddata-writer', 'provisioning', 'queue', 'restbox', 'shiny', 'table-importer', 'tde-exporter'], app.id)) {
          app.vendor = 'keboola';
        } else if (_.startsWith(app.id, 'geneea-')) {
          app.vendor = 'geneea';
        } else if (_.startsWith(app.id, 'vokurka.')) {
          app.vendor = 'vokurka';
        } else {
          app.vendor = '-unknown-';
        }
      }

      if (_.get(app, 'hasUI')) {
        app.flags.push('legacyAngularUI');
      }

      if (_.has(app, 'data.definition.type')) {
        if (_.startsWith(app.data.definition.type, 'quay')) {
          app.repoType = 'quay';
        } else if (_.startsWith(app.data.definition.type, 'dockerhub')) {
          app.repoType = 'dockerhub';
        } else if (_.startsWith(app.data.definition.type, 'builder')) {
          app.repoType = 'builder';
        } else {
          app.repoType = null;
        }
      }

      app.repoOptions = null;
      if (app.repoType === 'builder') {
        app.repoOptions = _.get(app, 'data.definition.build_options');
      }
      if (_.has(app, 'data.definition.repository.username') && _.has(app, 'data.definition.repository.#password')) {
        app.repoOptions = {
          username: app.data.definition.repository.username,
          '#password': app.data.definition.repository['#password'],
        };
      }

      if (!_.includes(types, app.type)) {
        types.push(app.type);
      }

      flags = _.union(flags, app.flags);
      result.push({
        id: app.id,
        vendor: app.vendor,
        isApproved: 1,
        isVisible: !_.includes(app.flags, 'excludeFromNewList'),
        createdBy: 'support@keboola.com',
        version: 1,
        name: app.name,
        type: app.type,
        repository: {
          type: app.repoType,
          uri: _.get(app, 'data.definition.uri', null),
          tag: _.get(app, 'data.definition.tag', null),
          options: app.repoOptions,
        },
        shortDescription: app.description,
        longDescription: app.longDescription,
        licenseUrl: _.get(app, 'data.vendor.licenseUrl', null),
        documentationUrl: app.documentationUrl,
        requiredMemory: _.get(app, 'data.memory', null),
        processTimeout: _.get(app, 'data.process_timeout', null),
        encryption: _.includes(app.flags, 'encrypt'),
        defaultBucket: _.get(app, 'data.default_bucket', false),
        defaultBucketStage: _.get(app, 'data.default_bucket_stage', null),
        forwardToken: _.get(app, 'data.forward_token', false),
        uiOptions: _.pull(app.flags, '3rdParty', 'encrypt', 'appInfo.fee', 'excludeFromNewList'),
        testConfiguration: {},
        configurationSchema: app.configurationSchema,
        configurationDescription: app.configurationDescription,
        emptyConfiguration: app.emptyConfiguration,
        actions: _.has(app, 'data.synchronous_actions') ? app.data.synchronous_actions : [],
        fees: _.includes(app.flags, 'appInfo.fee'),
        limits: null,
        logger: _.get(app, 'data.logging.type', 'standard'),
        loggerConfiguration: _.has(app, 'data.logging.gelf_server_type') ? {transport: app.data.logging.gelf_server_type} : {},
        icon32: app.ico32 ? app.id + '/32/1.png' : null,
        icon64: app.ico64 ? app.id + '/64/1.png' : null,
        legacyUri: (app.uri !== `https://syrup.keboola.com/docker/${app.id}`) ? app.uri : null,
      });
      callback();
    }, err2 => callbackMain(err2, result));
  });
};

const saveData = function(data, callbackMain) {
  async.parallel([
    function (cb) {
      rds.query('SET FOREIGN_KEY_CHECKS = 0;TRUNCATE TABLE appVersions;TRUNCATE TABLE apps;', err => cb(err));
    },
    function(cb) {
      async.each(data, (resApp, callback) => {
        const dbApp = db.formatAppInput(resApp);
        rds.query('INSERT IGNORE INTO apps SET ?', dbApp, (err) => {
          if (err) {
            console.log(resApp);
            throw err;
          }
          delete dbApp.vendor;
          delete dbApp.isApproved;
          rds.query('INSERT IGNORE INTO appVersions SET ?', dbApp, (err2) => {
            if (err2) {
              console.log(resApp);
              throw err2;
            }
            callback();
          });
        });
      }, cb);
    },
  ], callbackMain);
};

getData((err, res) => {
  if (err) {
    throw err;
  }
  saveData(res, () => process.exit());
});
