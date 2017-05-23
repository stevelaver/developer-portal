import Access from '../lib/Access';
import Identity from '../lib/Identity';
import UserPool from '../lib/UserPool';

const aws = require('aws-sdk');
const base64 = require('base-64');
const Promise = require('bluebird');

const error = require('../lib/error');

aws.config.setPromisesDependency(Promise);

/* eslint-disable */
class Email {
  send(to, subject, header, content, buttonUrl = null, buttonText = null) {
    return null;
  }
}
/* eslint-enable */

class Services {
  constructor(env) {
    this.env = env;
  }

  getEmail() {
    return new Email(
      new aws.SES({ apiVersion: '2010-12-01', region: this.env.REGION }),
      this.env.SES_EMAIL_FROM
    );
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

  static getAccess(db) {
    return new Access(db, error);
  }

  getECR(credentials) {
    return new aws.ECR({ region: this.env.REGION, credentials });
  }

  getSTS() {
    return new aws.STS({ region: this.env.REGION });
  }

  static getS3() {
    return new aws.S3();
  }

  static getError() {
    return error;
  }

  static getBase64() {
    return base64;
  }
}

export default Services;
