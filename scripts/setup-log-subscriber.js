'use script';
require('dotenv').config({path: '.env-test', silent: true});
const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const yaml = require('yamljs');

const lambda = new aws.Lambda({region: process.env.REGION});
const logs = new aws.CloudWatchLogs({region: process.env.REGION});

const args = process.argv.slice(2);

_.each(_.keys(yaml.load('./serverless.yml').functions), function(item) {
  if (item != 'logger') {
    setTimeout(function(){
      lambda.addPermission({
        Action: 'lambda:InvokeFunction',
        FunctionName: process.env.SERVICE_NAME + '-' + process.env.STAGE + '-logger',
        Principal: 'logs.' + process.env.REGION + '.amazonaws.com',
        StatementId: process.env.SERVICE_NAME + '-' + process.env.STAGE + '-' + item
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
    }, 5000);
  }
});

process.exit();
