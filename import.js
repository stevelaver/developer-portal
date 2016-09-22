'use script';
require('dotenv').config({path: '.env-test', silent: true});
var _ = require('lodash');
var async = require('async');
var aws = require('aws-sdk');
var fs = require('fs');
var mysql = require('mysql');

var rds = mysql.createConnection({
  host: process.env.FUNC_RDS_HOST,
  user: process.env.FUNC_RDS_USER,
  password: process.env.FUNC_RDS_PASSWORD,
  database: process.env.FUNC_RDS_DATABASE,
  ssl: process.env.RDS_SSL ? 'Amazon RDS' : false,
  multipleStatements: true
});

var args = process.argv.slice(2);

fs.readFile(args[0], 'utf8', (err, data) => {
  if (err) throw err;
  data = JSON.parse(data);
  var vendors = [];
  var apps = [];
  var flags = [];
  data.apis.forEach(function(app) {
    if (_.has(app, 'data.vendor.contact')) {
      //console.log(app.data.vendor.contact);
    }

    if (_.get(app, 'hasUI')) {
      app.flags.push('legacyAngularUI');
    }

    flags = _.union(flags, app.flags);
    apps.push({
      id: app.id,
      //@TODO app.uri
      vendor: '', //@TODO
      isApproved: 1,
      createdBy: 'support@keboola.com',
      version: 1,
      name: app.name,
      type: (app.type == 'extractor') ? 'reader' : ((app.type == 'writer') ? 'writer' : 'application'),
      imageUrl: _.get(app, 'data.definition.type'), //@TODO + _.get(app, 'data.definition.uri')
      imageTag: _.get(app, 'data.definition.tag'),
      shortDescription: app.description,
      longDescription: app.longDescription,
      licenseUrl: _.get(app, 'data.vendor.licenseUrl'),
      documentationUrl: app.documentationUrl,
      requiredMemory: _.get(app, 'data.memory'),
      processTimeout: _.get(app, 'data.process_timeout'),
      encryption: _.includes(app.flags, 'encrypt'),
      defaultBucket: _.get(app, 'data.default_bucket'),
      defaultBucketStage: _.get(app, 'data.default_bucket_stage'),
      forwardToken: _.get(app, 'data.forward_token'),
      uiOptions: _.pull(app.flags, '3rdParty', 'encrypt', 'appInfo.fee'),
      testConfiguration: '',
      configurationSchema: app.configurationSchema,
      configurationDescription: app.configurationDescription,
      emptyConfiguration: app.emptyConfiguration,
      actions: _.has(app, 'data.synchronous_actions') ? app.data.synchronous_actions : '[]',
      fees: _.includes(app.flags, 'appInfo.fee'),
      limits: null,
      logger: _.get(app, 'data.logging.type', 'standard'),
      loggerConfiguration: _.has(app, 'data.logging.gelf_server_type') ? {transport: app.data.logging.gelf_server_type} : {},
      icon32: '', //@TODO app.ico32
      icon64: '' //@TODO app.ico64
    });console.log(app);
  });

});