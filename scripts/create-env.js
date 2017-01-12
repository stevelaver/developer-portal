'use strict';

const _ = require('lodash');
const fs = require('fs');
const yaml = require('yamljs');

const args = process.argv.slice(2);

const getEnvVar = (name) => {
  if (!_.has(process.env, name)) {console.log(name);
    throw new Error(`Env variable ${name} does not exist`);
  }
  return process.env[name];
};

fs.writeFile(
  args[0],
  yaml.stringify({
    SERVICE_NAME: getEnvVar('SERVICE_NAME'),
    REGION: getEnvVar('REGION'),
    STAGE: getEnvVar('STAGE'),
    SES_EMAIL_FROM: getEnvVar('SES_EMAIL_FROM'),
    RDS_INSTANCE_CLASS: getEnvVar('RDS_INSTANCE_CLASS'),
    RDS_DATABASE: getEnvVar('RDS_DATABASE'),
    RDS_USER: getEnvVar('RDS_USER'),
    RDS_PASSWORD: getEnvVar('RDS_PASSWORD'),
    S3_BUCKET: getEnvVar('S3_BUCKET'),
    LOG_HOST: getEnvVar('LOG_HOST'),
    LOG_PORT: getEnvVar('LOG_PORT'),
    SLACK_HOOK_URL: getEnvVar('SLACK_HOOK_URL'),
    ACCOUNT_ID: getEnvVar('ACCOUNT_ID'),
    VPC_CF_STACK_ID: getEnvVar('VPC_CF_STACK_ID'),
    VPC_SECURITY_GROUP: getEnvVar('VPC_SECURITY_GROUP'),
    VPC_SUBNET1: getEnvVar('VPC_SUBNET1'),
    VPC_SUBNET2: getEnvVar('VPC_SUBNET2'),
    RDS_SUBNET_GROUP: getEnvVar('RDS_SUBNET_GROUP'),
    COGNITO_POOL_ID: getEnvVar('COGNITO_POOL_ID'),
    COGNITO_CLIENT_ID: getEnvVar('COGNITO_CLIENT_ID'),
    RDS_HOST: getEnvVar('RDS_HOST'),
    RDS_PORT: getEnvVar('RDS_PORT'),
    CLOUDFRONT_URI: getEnvVar('CLOUDFRONT_URI'),
    API_ENDPOINT: getEnvVar('API_ENDPOINT'),
  }),
  (err) => {
    if (err) {
      console.error(err);
    } else {
      console.info(`- Env saved to ${args[0]}`);
    }
    process.exit();
  }
);
