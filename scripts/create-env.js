'use strict';

const _ = require('lodash');
const fs = require('fs');
const yaml = require('yamljs');

const args = process.argv.slice(2);

const getEnvVar = (env, name) => {
  const varName = `${env}_${name}`;
  if (!_.has(process.env, varName)) {
    throw new Error(`Env variable ${varName} does not exist`);
  }
  return process.env[varName];
};

const env = args[1];
fs.writeFile(
  args[0],
  yaml.stringify({
    SERVICE_NAME: getEnvVar(env, 'SERVICE_NAME'),
    REGION: getEnvVar(env, 'REGION'),
    STAGE: getEnvVar(env, 'STAGE'),
    SES_EMAIL_FROM: getEnvVar(env, 'SES_EMAIL_FROM'),
    RDS_INSTANCE_CLASS: getEnvVar(env, 'RDS_INSTANCE_CLASS'),
    RDS_DATABASE: getEnvVar(env, 'RDS_DATABASE'),
    RDS_USER: getEnvVar(env, 'RDS_USER'),
    RDS_PASSWORD: getEnvVar(env, 'RDS_PASSWORD'),
    RDS_SSL: getEnvVar(env, 'RDS_SSL'),
    S3_BUCKET: getEnvVar(env, 'S3_BUCKET'),
    LOG_HOST: getEnvVar(env, 'LOG_HOST'),
    LOG_PORT: getEnvVar(env, 'LOG_PORT'),
    SLACK_HOOK_URL: getEnvVar(env, 'SLACK_HOOK_URL'),
    ACCOUNT_ID: getEnvVar(env, 'ACCOUNT_ID'),
    VPC_CF_STACK_ID: getEnvVar(env, 'VPC_CF_STACK_ID'),
    VPC_SECURITY_GROUP: getEnvVar(env, 'VPC_SECURITY_GROUP'),
    VPC_SUBNET1: getEnvVar(env, 'VPC_SUBNET1'),
    VPC_SUBNET2: getEnvVar(env, 'VPC_SUBNET2'),
    RDS_SUBNET_GROUP: getEnvVar(env, 'RDS_SUBNET_GROUP'),
    COGNITO_POOL_ID: getEnvVar(env, 'COGNITO_POOL_ID'),
    COGNITO_CLIENT_ID: getEnvVar(env, 'COGNITO_CLIENT_ID'),
    RDS_HOST: getEnvVar(env, 'RDS_HOST'),
    RDS_PORT: getEnvVar(env, 'RDS_PORT'),
    CLOUDFRONT_URI: getEnvVar(env, 'CLOUDFRONT_URI'),
    API_ENDPOINT: getEnvVar(env, 'API_ENDPOINT'),
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
