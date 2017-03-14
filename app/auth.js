
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
      .then((data) => {
        if ('ChallengeName' in data && data.ChallengeName === 'SMS_MFA') {
          return {
            message: 'Verification code has been sent to your mobile phone',
            session: data.Session,
          };
        }
        return {
          token: data.AuthenticationResult.IdToken,
          accessToken: data.AuthenticationResult.AccessToken,
          refreshToken: data.AuthenticationResult.RefreshToken,
          expiresIn: data.AuthenticationResult.ExpiresIn,
        };
      });
  }

  loginWithCode(email, code, session) {
    return this.cognito.respondToAuthChallenge({
      ChallengeName: 'SMS_MFA_CODE',
      Session: session,
      ClientId: this.env.COGNITO_CLIENT_ID,
      ChallengeResponses: {
        USERNAME: email,
        SMS_MFA_CODE: code,
      },
    }).promise()
      .then(data => ({
        token: data.AuthenticationResult.IdToken,
        accessToken: data.AuthenticationResult.AccessToken,
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

  signUpCreateVendor(vendorApp, email, password, name, vendor) {
    const vendorId = `tv${Date.now()}${Math.random()}`.substr(0, 32);
    return this.db.connect(this.env)
      .then(() => vendorApp.create({
        id: vendorId,
        name: vendor.name,
        address: vendor.address,
        email: vendor.email,
        createdBy: email,
      }, false))
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
            Value: vendorId,
          },
        ],
      }).promise())
      .then(() => vendorId);
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

  confirmMfa(token, code) {
    return this.cognito.verifyUserAttribute({
      AccessToken: token,
      Code: code,
      AttributeName: 'phone_number',
    }).promise()
      .then(() => null);
  }
}

export default Auth;
