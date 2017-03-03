
class Auth {
  constructor(cognito, db, env, err) {
    this.cognito = cognito;
    this.db = db;
    this.env = env;
    this.err = err;
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
        refreshToken: data.AuthenticationResult.RefreshToken,
        expiresIn: data.AuthenticationResult.ExpiresIn,
      }));
  }

  refreshToken(token) {
    return this.cognito.adminInitiateAuth({
      AuthFlow: 'REFRESH_TOKEN',
      ClientId: this.env.COGNITO_CLIENT_ID,
      UserPoolId: this.env.COGNITO_POOL_ID,
      AuthParameters: {
        USERNAME: 'keboola.dev.portal.test@gmail.com',
        REFRESH_TOKEN: token,
      },
    }).promise()
      .then(data => ({
        token: data.AuthenticationResult.IdToken,
        expiresIn: data.AuthenticationResult.ExpiresIn,
      }));
  }

  signUp(email, password, name, vendor) {
    return this.db.connect(this.env)
      .then(() => this.db.checkVendorExists(vendor))
      .then(() => this.db.end())
      .catch((err) => {
        this.db.end();
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

  resend(email, password) {
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

  enableMfa(email, phone) {
    return this.cognito.adminUpdateUserAttributes({
      UserPoolId: this.env.COGNITO_POOL_ID,
      Username: email,
      UserAttributes: [
        {
          Name: 'phone_number',
          Value: phone,
        },
      ],
    }).promise()
      .catch((err) => {
        if (err.code === 'InvalidParameterException') {
          throw this.err.unprocessable('Phone number must be valid and in format +[country code][number]');
        }
        throw err;
      })
      .then(() => this.cognito.adminSetUserSettings({
        UserPoolId: this.env.COGNITO_POOL_ID,
        Username: email,
        MFAOptions: [
          {
            AttributeName: 'phone_number',
            DeliveryMedium: 'SMS',
          },
        ],
      }).promise());
  }
}

export default Auth;
