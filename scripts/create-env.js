'use strict';

const _ = require('lodash');
const fs = require('fs');
const yaml = require('yamljs');

const args = process.argv.slice(2);

const getEnvVar = (name, prefix = null) => {
  const varName = prefix ? `${prefix}_${name}` : name;
  if (!_.has(process.env, varName)) {
    throw new Error(`Env variable ${varName} does not exist`);
  }
  return process.env[varName];
};

const envPrefix = _.get(args, 1, null);

fs.writeFile(
  args[0],
  yaml.stringify({
    SERVICE_NAME: getEnvVar('SERVICE_NAME', envPrefix),
    REGION: getEnvVar('REGION', envPrefix),
    STAGE: getEnvVar('STAGE', envPrefix),
    SES_EMAIL_FROM: getEnvVar('SES_EMAIL_FROM', envPrefix),
    RDS_INSTANCE_CLASS: getEnvVar('RDS_INSTANCE_CLASS', envPrefix),
    RDS_DATABASE: getEnvVar('RDS_DATABASE', envPrefix),
    RDS_USER: getEnvVar('RDS_USER', envPrefix),
    RDS_PASSWORD: getEnvVar('RDS_PASSWORD', envPrefix),
    S3_BUCKET: getEnvVar('S3_BUCKET', envPrefix),
    LOG_HOST: getEnvVar('LOG_HOST', envPrefix),
    LOG_PORT: getEnvVar('LOG_PORT', envPrefix),
    SLACK_HOOK_URL: getEnvVar('SLACK_HOOK_URL', envPrefix),
    ACCOUNT_ID: getEnvVar('ACCOUNT_ID', envPrefix),
    VPC_CF_STACK_ID: getEnvVar('VPC_CF_STACK_ID', envPrefix),
    VPC_SECURITY_GROUP: getEnvVar('VPC_SECURITY_GROUP', envPrefix),
    RDS_SECURITY_GROUP: getEnvVar('RDS_SECURITY_GROUP', envPrefix),
    VPC_SUBNET1: getEnvVar('VPC_SUBNET1', envPrefix),
    VPC_SUBNET2: getEnvVar('VPC_SUBNET2', envPrefix),
    RDS_SUBNET_GROUP: getEnvVar('RDS_SUBNET_GROUP', envPrefix),
    COGNITO_POOL_ID: getEnvVar('COGNITO_POOL_ID', envPrefix),
    COGNITO_CLIENT_ID: getEnvVar('COGNITO_CLIENT_ID', envPrefix),
    RDS_HOST: getEnvVar('RDS_HOST', envPrefix),
    RDS_PORT: getEnvVar('RDS_PORT', envPrefix),
    CLOUDFRONT_URI: getEnvVar('CLOUDFRONT_URI', envPrefix),
    API_ENDPOINT: getEnvVar('API_ENDPOINT', envPrefix),
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
