import Email from '../lib/email';
import Identity from '../lib/identity';
import Notification from '../lib/notification';
import UserPool from '../lib/UserPool';

const aws = require('aws-sdk');
const Promise = require('bluebird');
const requestLite = require('request-promise-lite');

const error = require('../lib/error');

aws.config.setPromisesDependency(Promise);

class InitApp {
  constructor(env) {
    this.env = env;
  }

  getEmail() {
    return new Email(
      new aws.SES({ apiVersion: '2010-12-01', region: this.env.REGION }),
      this.env.SES_EMAIL_FROM,
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
}

export default InitApp;
