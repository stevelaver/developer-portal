'use strict';

const _ = require('lodash');
const aws = require('aws-sdk');

class logSubscription {
  constructor(serverless) {
    this.serverless = serverless;

    this.provider = this.serverless.getProvider('aws');
    aws.config.update({
      region: process.env.REGION
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

    const loggerFunctionData = this.serverless.service.getFunction(loggerFunction);
    const loggerLogicalId = this.provider.naming.getLambdaLogicalId(loggerFunction);
    _.merge(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      {
        LambdaPermissionForSubscription: {
          Type: 'AWS::Lambda::Permission',
          Properties: {
            FunctionName: loggerFunctionData.name,
            Action: 'lambda:InvokeFunction',
            Principal: `logs.${process.env.REGION}.amazonaws.com`,
            SourceArn: `arn:aws:logs:${process.env.REGION}:${process.env.ACCOUNT_ID}:log-group:/aws/lambda/*`
          },
          DependsOn: [loggerLogicalId]
        }
      }
    );

    const functions = this.serverless.service.getAllFunctions();
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
              },
              DependsOn: ['LambdaPermissionForSubscription']
            }
          }
        );
      }
    });
  }
}

module.exports = logSubscription;