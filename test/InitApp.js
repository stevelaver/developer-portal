import Identity from '../lib/identity';
import UserPool from '../lib/UserPool';

const aws = require('aws-sdk');
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

class InitApp {
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
}

export default InitApp;
