const moment = require('moment');

class Auth {
  constructor(cognito, env, err) {
    this.cognito = cognito;
    this.env = env;
    this.err = err;
  }

  confirm(email, code) {
    return this.cognito.confirmSignUp({
      ClientId: this.env.COGNITO_CLIENT_ID,
      ConfirmationCode: code,
      Username: email,
    }).promise()
      .then(() => this.cognito.adminDisableUser({
        UserPoolId: this.env.COGNITO_POOL_ID,
        Username: email,
      }).promise())
      .then(() => this.cognito.adminGetUser({
        UserPoolId: this.env.COGNITO_POOL_ID,
        Username: email,
      }).promise());
  }

  confirmResend(email, password) {
    return this.cognito.adminInitiateAuth({
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      ClientId: this.env.COGNITO_CLIENT_ID,
      UserPoolId: this.env.COGNITO_POOL_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }).promise()
    .catch((err) => {
      if (err && err.code === 'UserNotConfirmedException') {
        return this.cognito.resendConfirmationCode({
          ClientId: this.env.COGNITO_CLIENT_ID,
          Username: email,
        }).promise();
      } else if (err && err.code === 'NotAuthorizedException') {
        throw this.err.badRequest('Already confirmed');
      } else {
        throw err;
      }
    });
  }

  forgot(email) {
    return this.cognito.forgotPassword({
      ClientId: this.env.COGNITO_CLIENT_ID,
      Username: email,
    }).promise();
  }

  confirmForgotPassword(email, password, code) {
    return this.cognito.confirmForgotPassword({
      ClientId: this.env.COGNITO_CLIENT_ID,
      ConfirmationCode: code,
      Password: password,
      Username: email,
    }).promise();
  }

  login(email, password) {
    return this.cognito.adminInitiateAuth({
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      ClientId: this.env.COGNITO_CLIENT_ID,
      UserPoolId: this.env.COGNITO_POOL_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }).promise()
    .then(data => ({
      token: data.AuthenticationResult.IdToken,
      expires: moment().add(data.AuthenticationResult.ExpiresIn, 's').utc()
        .format(),
    }));
  }

  signUp(db, email, password, name, vendor) {
    return db.queryAsync('SELECT * FROM `vendors` WHERE `id` = ?', [vendor])
    .spread((rows) => {
      if (!rows) {
        throw this.err.notFound(`Vendor ${vendor} does not exist`);
      }
    })
    .catch((err) => {
      db.end();
      throw err;
    })
    .then(() => this.cognito.signUp({
      ClientId: this.env.COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'name',
          Value: name,
        },
      ],
    }).promise())
    .then(() => this.cognito.adminAddUserToGroup({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
      GroupName: vendor,
    }).promise())
    .then(() => db.endAsync());
  }
}

export default Auth;
