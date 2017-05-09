import Email from './email';
import Identity from './identity';
import Notification from './notification';
import UserPool from './UserPool';
import Validation from './validation';

// const awsXRay = require('aws-xray-sdk-core');
// const aws = awsXRay.captureAWS(require('aws-sdk'));
const aws = require('aws-sdk');
const base64 = require('base-64');
const joiBase = require('joi');
const joiExtension = require('joi-date-extensions');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');
const requestLite = require('request-promise-lite');

const error = require('../lib/error');

aws.config.setPromisesDependency(Promise);

class Services {
  constructor(env) {
    this.env = env;
  }

  getECR(credentials) {
    return new aws.ECR({ region: this.env.REGION, credentials });
  }

  getSTS() {
    return new aws.STS({ region: this.env.REGION });
  }

  static getBase64() {
    return base64;
  }

  getEmail() {
    return new Email(
      new aws.SES({ apiVersion: '2010-12-01', region: this.env.REGION }),
      this.env.SES_EMAIL_FROM,
    );
  }

  static getError() {
    return error;
  }

  static getIdentity() {
    return new Identity(jwt, error);
  }

  static getJoi() {
    return joiBase.extend(joiExtension);
  }

  getNotification() {
    return new Notification(
      requestLite,
      this.env.SLACK_HOOK_URL,
      this.env.SERVICE_NAME,
    );
  }

  static getS3() {
    return new aws.S3();
  }

  getUserPool() {
    return new UserPool(
      new aws.CognitoIdentityServiceProvider({ region: this.env.REGION }),
      this.env.COGNITO_POOL_ID,
      this.env.COGNITO_CLIENT_ID,
      Identity,
      error,
    );
  }

  static getValidation() {
    return new Validation(joiBase.extend(joiExtension), error);
  }
}

export default Services;
