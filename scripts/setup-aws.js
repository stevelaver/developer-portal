'use script';
require('dotenv').config({path: '.env-test', silent: true});
var _ = require('lodash');
var async = require('async');
var aws = require('aws-sdk');
var yaml = require('yamljs');

var lambda = new aws.Lambda({region: process.env.REGION});
var logs = new aws.CloudWatchLogs({region: process.env.REGION});

var args = process.argv.slice(2);

var slsYml = yaml.load('./serverless.yml');
var functions = _.keys(slsYml.functions);

_.each(functions, function(item) {console.log(item);
  if (item != 'logger') {
    setTimeout(function(){
      lambda.addPermission({
        Action: 'lambda:InvokeFunction',
        FunctionName: process.env.SERVICE_NAME + '-' + process.env.STAGE + '-logger',
        Principal: 'logs.' + process.env.REGION + '.amazonaws.com',
        StatementId: process.env.SERVICE_NAME + '-' + process.env.STAGE + item + '__' + process.env.LOG_APP_NAME + '-' + process.env.LOG_PROGRAM
      }, function(err) {
        if (err) {
          console.log('FUNCTION ' + item);
          return console.log(err);
        }

        logs.putSubscriptionFilter({
          destinationArn: args[0],
          filterName: 'LambdaToPapertrail-' + process.env.SERVICE_NAME + '-' + process.env.STAGE,
          filterPattern: '',
          logGroupName: '/aws/lambda/' + process.env.SERVICE_NAME + '-' + process.env.STAGE + '-' + item
        }, function(err) {
          if (err) {
            if (err.code != 'ResourceNotFoundException') {
              console.log('FUNCTION ' + item);
              return console.log(err);
            }
          }
        });
      });
    }, 2000);
  }
});
