import Access from './access';
import Email from './email';
import Identity from './Identity';
import Notification from './notification';
import UserPool from './userPool';
import Validation from './validation';
import UserPoolWithDatabase from './userPoolWithDatabase';
import DbUsers from './db/dbUsers';
import DbApps from './db/dbApps';

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

  static getError() {
    return error;
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

  static getBase64() {
    return base64;
  }

  getEmail() {
    return new Email(
      new aws.SES({ apiVersion: '2010-12-01', region: this.env.REGION }),
      this.env.SES_EMAIL_FROM,
    );
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

  getUserPoolWithDatabase(db) {
    return Services.getDbUsers(db)
      .then(dbUsers => new Promise(res => res(new UserPoolWithDatabase(
        this.getUserPool(),
        dbUsers,
      ))));
  }

  static getValidation() {
    return new Validation(joiBase.extend(joiExtension), error);
  }

  static getDbApps(db) {
    return new Promise(res => res(new DbApps(db.getConnection(), error)));
  }

  static getDbUsers(db) {
    return new Promise(res => res(new DbUsers(db.getConnection(), error)));
  }
}

export default Services;
