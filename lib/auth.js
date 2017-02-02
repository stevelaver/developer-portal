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

  joinVendor(db, Identity, user, vendor) {
    return db.connect(this.env)
      .then(() => db.checkVendorExists(vendor))
      .then(() => db.end())
      .catch((err) => {
        db.end();
        throw err;
      })
      .then(() => this.cognito.adminGetUser({
        UserPoolId: this.env.COGNITO_POOL_ID,
        Username: user.email,
      }).promise())
      .then(data => Identity.formatUser(data))
      .then((data) => {
        if (data.vendors.indexOf(vendor) !== -1) {
          throw this.err.badRequest(`User ${user.email} is already member of vendor ${vendor}`);
        }
        data.vendors.push(vendor);
        return this.cognito.adminUpdateUserAttributes({
          UserPoolId: this.env.COGNITO_POOL_ID,
          Username: user.email,
          UserAttributes: [
            {
              Name: 'profile',
              Value: data.vendors.join(','),
            },
          ],
        }).promise();
      });
  }

  signUp(db, email, password, name, vendor) {
    return db.connect(this.env)
      .then(() => db.checkVendorExists(vendor))
      .then(() => db.end())
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
          {
            Name: 'profile',
            Value: vendor,
          },
        ],
      }).promise());
  }
}

export default Auth;
