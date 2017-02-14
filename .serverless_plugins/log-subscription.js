'use strict';

const _ = require('lodash');
const aws = require('aws-sdk');
const yaml = require('yamljs');

const env = yaml.load(`${__dirname}/../env.yml`);

class logSubscription {
  constructor(serverless) {
    this.serverless = serverless;

    this.provider = this.serverless.getProvider('aws');
    aws.config.update({
      region: env.REGION
    });

    this.hooks = {
      'deploy:compileEvents': this.afterDeploy.bind(this),
    };
  }

  afterDeploy() {
    this.serverless.cli.log('Creating log subscriptions for functions...');
    const loggerFunction = this.serverless.service.custom.logSubscriptionFunction;
    if (!loggerFunction) {
      throw new this.serverless.classes.Error('Configure the logger function in custom.logSubscriptionFunction of serverless.yml');
    }

    _.each(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, (val, key) => {
      if (val.Type === 'AWS::Lambda::Permission' && val.Properties.Principal === 'apigateway.amazonaws.com') {
        _.unset(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, key);
      }
    });

    // _.merge(
    //   this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
    //   {
    //     LambdaPermissionForApi: {
    //       Type: 'AWS::Lambda::Permission',
    //       Properties: {
    //         Action: "lambda:InvokeFunction",
    //         FunctionName: '*',
    //         Principal: "apigateway.amazonaws.com",
    //         SourceArn: {
    //           "Fn::Join": [
    //             "",
    //             [
    //               "arn:aws:execute-api:",
    //               {
    //                 "Ref": "AWS::Region"
    //               },
    //               ":",
    //               {
    //                 "Ref": "AWS::AccountId"
    //               },
    //               ":",
    //               {
    //                 "Ref": "ApiGatewayRestApi"
    //               },
    //               "/*/*"
    //             ]
    //           ]
    //         }
    //       }
    //     }
    //   }
    // );

    const loggerFunctionData = this.serverless.service.getFunction(loggerFunction);
    _.merge(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      {
        LambdaPermissionForSubscription: {
          Type: 'AWS::Lambda::Permission',
          Properties: {
            FunctionName: loggerFunctionData.name,
            Action: 'lambda:InvokeFunction',
            Principal: `logs.${env.REGION}.amazonaws.com`,
            SourceArn: `arn:aws:logs:${env.REGION}:${env.ACCOUNT_ID}:log-group:/aws/lambda/*`
          }
        }
      }
    );

    const functions = this.serverless.service.getAllFunctions();
    const loggerLogicalId = this.provider.naming.getLambdaLogicalId(loggerFunction);
    functions.forEach((functionName) => {
      if (functionName !== loggerFunction) {
        const functionData = this.serverless.service.getFunction(functionName);
        const normalizedFunctionName = this.provider.naming.getNormalizedFunctionName(functionName);
        _.merge(
          this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
          {
            [`${normalizedFunctionName}SubscriptionFilter`]: {
              Type: 'AWS::Logs::SubscriptionFilter',
              Properties: {
                DestinationArn: { 'Fn::GetAtt': [loggerLogicalId, "Arn"] },
                FilterPattern: '',
                LogGroupName: `/aws/lambda/${functionData.name}`,
              }
            }
          }
        );
      }
    });
  }
}

module.exports = logSubscription;