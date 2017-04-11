import Email from './email';
import Identity from './identity';
import Notification from './notification';
import UserPool from './UserPool';
import Validation from './validation';

const aws = require('aws-sdk');
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

  static getECR(credentials) {
    return new aws.ECR({ region: process.env.REGION, credentials });
  }

  static getSTS() {
    return new aws.STS({ region: process.env.REGION });
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
