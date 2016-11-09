'use strict';

const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const exec = require('child_process').exec;
const execsql = require('../lib/execsql');
const fs = require('fs');
const mysql = require('mysql');
const yaml = require('yamljs');

let env = {};
if (fs.existsSync(`${__dirname}/../env.yml`)) {
  env = yaml.load(`${__dirname}/../env.yml`);
}

const done = function (err) {
  if (err) {
    throw err;
  }
  process.exit();
};

const args = process.argv.slice(2);

switch (args[0]) {

  case 'save-env': {
    const dbName = process.env.SERVICE_NAME.replace(/\W/g, '').substr(0, 16);
    const newEnv = {
      SERVICE_NAME: process.env.SERVICE_NAME,
      REGION: process.env.REGION,
      STAGE: process.env.STAGE,
      SES_EMAIL_FROM: process.env.SES_EMAIL_FROM,
      RDS_INSTANCE_CLASS: process.env.RDS_INSTANCE_CLASS,
      RDS_DATABASE: dbName,
      RDS_USER: dbName,
      RDS_PASSWORD: process.env.RDS_PASSWORD,
      RDS_SSL: 'Amazon RDS',
      S3_BUCKET: `${process.env.SERVICE_NAME}-icons`,
      LOG_HOST: process.env.LOG_HOST,
      LOG_PORT: process.env.LOG_PORT,
      SLACK_HOOK_URL: process.env.SLACK_HOOK_URL,
    };
    fs.writeFile(
      `${__dirname}/../env.yml`,
      yaml.stringify(newEnv),
      (err2) => {
        console.info('- Env saved to env.yml');
        return done(err2);
      }
    );
    break;
  }
  case 'save-account-id': {
    exec('aws sts get-caller-identity --output text --query Account', (err, out) => {
      if (err) {
        console.error(`AWS get identity error: ${err}`);
        done();
      }
      env.ACCOUNT_ID = _.trim(out);
      fs.writeFile(
        `${__dirname}/../env.yml`,
        yaml.stringify(env),
        (err2) => {
          console.info(`- Account id saved: ${env.ACCOUNT_ID}`);
          return done(err2);
        }
      );
    });
    break;
  }
  case 'register-email': {
    const region = args[1];
    const email = args[2];
    exec(`aws ses verify-email-identity --region ${region} --email-address ${email}`, (err) => {
      if (err) {
        console.error(`SES registration error: ${err}`);
      } else {
        console.info(`- Email ${email} registered in SES, now confirm the email`);
      }
      return done();
    });
    break;
  }
  case 'add-email-policy': {
    exec(`aws ses put-identity-policy --region ${env.REGION} --identity ${env.SES_EMAIL_FROM} \
      --policy-name Cognito-SES-Policy --policy '{ "Statement":[{"Effect": "Allow","Principal": {"Service": "cognito-idp.amazonaws.com"}, "Action": ["ses:SendEmail", "ses:SendRawEmail"],"Resource": "arn:aws:ses:${env.REGION}:${env.ACCOUNT_ID}:identity/${env.SES_EMAIL_FROM}" }] }'`, (err) => {
      if (err) {
        console.error(`SES put policy error: ${err}`);
      } else {
        console.info(`- Email policy on ${env.SES_EMAIL_FROM} applied`);
      }
      return done();
    });
    break;
  }
  case 'create-vpc': {
    const cf = new aws.CloudFormation({ region: env.REGION });
    async.waterfall([
      (cb) => {
        cf.createStack({
          StackName: `${env.SERVICE_NAME}-vpc`,
          TemplateBody: fs.readFileSync(`${__dirname}/cf-vpc.json`, 'utf8'),
        }, (err, res) => {
          if (err) {
            cb(err);
          } else {
            cb(null, res.StackId);
          }
        });
      },
      (stackId, cb) => {
        env.VPC_CF_STACK_ID = stackId;
        cf.waitFor('stackCreateComplete', { StackName: stackId }, (err, res) => {
          if (err) {
            cb(err);
          }
          cb(null, _.keyBy(res.Stacks[0].Outputs, 'OutputKey'));
        });
      },
      (output, cb) => {
        env.VPC_SECURITY_GROUP = output.vpcSecurityGroup.OutputValue;
        env.VPC_SUBNET1 = output.vpcSubnet1.OutputValue;
        env.VPC_SUBNET2 = output.vpcSubnet2.OutputValue;
        env.RDS_SUBNET_GROUP = output.rdsSubnetGroup.OutputValue;
        fs.writeFile(
          `${__dirname}/../env.yml`,
          yaml.stringify(env),
          err2 => cb(err2)
        );
      },
    ], done);
    break;
  }
  case 'delete-vpc': {
    const cf = new aws.CloudFormation({ region: env.REGION });
    async.waterfall([
      (cb) => {
        cf.deleteStack({ StackName: env.VPC_CF_STACK_ID }, err => cb(err));
      },
      (cb) => {
        cf.waitFor('stackDeleteComplete', { StackName: env.VPC_CF_STACK_ID }, err => cb(err));
      },
    ], done);
    break;
  }
  case 'create-cognito': {
    async.waterfall([
      (cb2) => {
        const emailArn = `arn:aws:ses:${env.REGION}:${env.ACCOUNT_ID}:identity/${env.SES_EMAIL_FROM}`;
        exec(`aws cognito-idp create-user-pool --region ${env.REGION} --pool-name ${env.SERVICE_NAME} \
          --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
          --email-configuration SourceArn=${emailArn} --auto-verified-attributes email`, (err, out) => {
          if (err) {
            cb2(`Cognito Create Pool error: ${err}`);
          }
          const poolId = JSON.parse(out).UserPool.Id;
          console.info(`- Cognito User Pool created: ${poolId}`);
          cb2(null, poolId);
        });
      },
      (poolId, cb2) => {
        exec(`aws cognito-idp add-custom-attributes --region ${env.REGION} --user-pool-id ${poolId} \
          --custom-attributes '[{"Name":"isAdmin","AttributeDataType":"Number","DeveloperOnlyAttribute":false,"Mutable":true,"Required": false,"NumberAttributeConstraints":{"MinValue":"0","MaxValue":"1"}}]'`, (err) => {
          if (err) {
            cb2(`Cognito Create Pool error: ${err}`);
          }
          console.info('- Attributes to Cognito User Pool added');
          cb2(null, poolId);
        });
      },
      (poolId, cb2) => {
        exec(`aws cognito-idp create-user-pool-client --region ${env.REGION} --user-pool-id ${poolId} --client-name ${env.SERVICE_NAME} \
          --no-generate-secret --read-attributes profile email name "custom:isAdmin" --write-attributes profile email name "custom:isAdmin" \
          --explicit-auth-flows ADMIN_NO_SRP_AUTH`, (err, out) => {
          if (err) {
            cb2(`Cognito Create Pool error: ${err}`);
          }
          const clientId = JSON.parse(out).UserPoolClient.ClientId;
          console.info('- Cognito User Pool Client created');
          cb2(null, { poolId, clientId });
        });
      },
    ], (err, res) => {
      if (err) {
        console.error(`Cognito pool create error: ${err}`);
        return done();
      }

      env.COGNITO_POOL_ID = res.poolId;
      env.COGNITO_CLIENT_ID = res.clientId;
      fs.writeFile(
        `${__dirname}/../env.yml`,
        yaml.stringify(env),
        err2 => done(err2)
      );
    });
    break;
  }
  case 'update-cognito':
    async.waterfall([
      (cb2) => {
        exec(`aws cognito-idp update-user-pool --region ${env.REGION} \
          --user-pool-id ${env.COGNITO_POOL_ID} \
          --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
          --email-configuration SourceArn=arn:aws:ses:${env.REGION}:${env.ACCOUNT_ID}:identity/${env.SES_EMAIL_FROM} \
          --auto-verified-attributes email \
          --lambda-config '{"CustomMessage": "arn:aws:lambda:${env.REGION}:${env.ACCOUNT_ID}:function:${env.SERVICE_NAME}-${env.STAGE}-authEmailTrigger"}'`, cb2);
      },
      (cb2) => {
        exec(`aws lambda add-permission --region ${env.REGION} \
          --statement-id CSI_customMessage \
          --function-name ${env.SERVICE_NAME}-${env.STAGE}-authEmailTrigger \
          --principal 'cognito-idp.amazonaws.com' \
          --action lambda:InvokeFunction \
          --source-arn 'arn:aws:cognito-idp:${env.REGION}:${env.ACCOUNT_ID}:userpool/${env.COGNITO_POOL_ID}'`, cb2);
      },
    ], (err) => {
      if (err) {
        console.error(`Cognito update pool update error: ${err}`);
      } else {
        console.info(`- Cognito user pool ${env.COGNITO_POOL_ID} updated`);
      }
      done();
    });
    break;

  case 'save-cloudformation-output':
    exec(`aws cloudformation describe-stacks --region ${env.REGION} --stack-name ${env.SERVICE_NAME}-${env.STAGE}`, (err, out) => {
      if (err) {
        console.error(`Describe CloudFormation stack error: ${err}`);
        return done();
      }
      const res = JSON.parse(out);

      if (!_.has(res, 'Stacks') || res.Stacks.length < 1) {
        console.error(`Describe CloudFormation stack error: ${JSON.stringify(res)}`);
        done();
      }

      const result = {};
      _.each(res.Stacks[0].Outputs, (item) => {
        if (_.includes(['RdsUri', 'RdsPort', 'CloudFrontUri', 'ServiceEndpoint'], item.OutputKey)) {
          result[item.OutputKey] = item.OutputValue;
        }
      });

      env.RDS_HOST = result.RdsUri;
      env.RDS_PORT = result.RdsPort;
      env.CLOUDFRONT_URI = result.CloudFrontUri;
      env.API_ENDPOINT = result.ServiceEndpoint;
      fs.writeFile(
        `${__dirname}/../env.yml`,
        yaml.stringify(env),
        (err2) => {
          console.info('- CloudFormation stack described');
          return done(err2);
        }
      );
    });
    break;

  case 'init-database':
    execsql.execFile(mysql.createConnection({
      host: env.RDS_HOST,
      port: env.RDS_PORT,
      user: env.RDS_USER,
      password: env.RDS_PASSWORD,
      database: env.RDS_DATABASE,
      ssl: env.RDS_SSL,
      multipleStatements: true,
    }), `${__dirname}/../rds-model.sql`, err => done(err));
    break;

  case 'subscribe-logs':
    async.each(_.keys(yaml.load(`${__dirname}/../serverless.yml`).functions), (item, cb2) => {
      if (item !== 'logger') {
        async.waterfall([
          (cb3) => {
            exec(`serverless invoke -f ${item}`, (err) => {
              if (err) {
                console.warn(`Serverless invoke ${item} error: ${err}`);
              }
              cb3();
            });
          },
          (cb3) => {
            exec(`aws lambda add-permission --region ${env.REGION} \
              --function-name ${env.SERVICE_NAME}-${env.STAGE}-logger \
              --statement-id ${env.SERVICE_NAME}-${env.STAGE}-${item} \
              --action lambda:InvokeFunction \
              --principal logs.${env.REGION}.amazonaws.com`, (err) => {
              if (err && !_.includes(err.message, 'ResourceConflictException')) {
                console.warn(`- Add function ${item} permission error: ${err}`);
              }
              cb3();
            });
          },
          (cb3) => {
            setTimeout(() => {
              exec(`aws logs put-subscription-filter --region ${env.REGION} \
                --filter-pattern '' \
                --filter-name LambdaToPapertrail-${env.SERVICE_NAME}-${env.STAGE} \
                --log-group-name /aws/lambda/${env.SERVICE_NAME}-${env.STAGE}-${item} \
                --destination-arn arn:aws:lambda:${env.REGION}:${env.ACCOUNT_ID}:function:${env.SERVICE_NAME}-${env.STAGE}-logger`, (err) => {
                if (err) {
                  console.warn(`- Put subscription filter ${item} error: ${err}`);
                }
                cb3(err);
              });
            }, 10000);
          },
        ], cb2);
      } else {
        cb2();
      }
    }, (err) => {
      if (err) {
        console.error(`Subscribe logs error: ${err}`);
      }
      console.info('- Logs subscribed');
      done();
    });
    break;

  case 'delete-cognito':
    exec(`aws cognito-idp delete-user-pool --region ${env.REGION} --user-pool-id ${env.COGNITO_POOL_ID}`, (err) => {
      if (err) {
        console.error(`Cognito pool ${env.COGNITO_POOL_ID} removal error: ${err}`);
      } else {
        console.info(`- Cognito pool ${env.COGNITO_POOL_ID} removed`);
      }
      done();
    });
    break;

  case 'delete-logs':
    async.each(_.keys(yaml.load(`${__dirname}/../serverless.yml`).functions), (item, cb) => {
      exec(
        `aws logs delete-log-group --region ${env.REGION} \
        --log-group-name /aws/lambda/${env.SERVICE_NAME}-${env.STAGE}-${item}`,
        () => cb()
      );
    }, () => {
      console.info('- Logs deleted');
      done();
    });
    break;

  case 'empty-bucket':
    exec(`aws s3 rm s3://${env.S3_BUCKET}/* --recursive`, (err) => {
      if (err) {
        console.error(`Emptying bucket ${env.S3_BUCKET} error: ${err}`);
      } else {
        console.info(`Bucket ${env.S3_BUCKET} empty`);
      }
      done();
    });
    break;

  default:
    console.error('Unknown command');
    process.exit();
}
