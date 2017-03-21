
class Auth {
  constructor(init, db, env, err) {
    this.db = db;
    this.env = env;
    this.err = err;
    this.userPool = init.getUserPool();
  }

  forgot(email) {
    return this.userPool.forgotPassword(email);
  }

  confirmForgotPassword(email, password, code) {
    return this.userPool.confirmForgotPassword(email, password, code);
  }

  login(email, password) {
    return this.userPool.getCognito().adminInitiateAuth({
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
    return this.userPool.getCognito().respondToAuthChallenge({
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
    return this.userPool.getCognito().adminInitiateAuth({
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

  signUp(email, password, name) {
    return this.userPool.signUp(email, password, name);
  }

  confirm(email, code) {
    return this.userPool.getCognito().confirmSignUp({
      ClientId: this.env.COGNITO_CLIENT_ID,
      ConfirmationCode: code,
      Username: email,
    }).promise();
  }

  resend(email, password) {
    return this.userPool.getCognito().adminInitiateAuth({
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
          return this.userPool.getCognito().resendConfirmationCode({
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
    return this.userPool.updateUserAttribute(email, 'phone_number', phone)
      .catch((err) => {
        if (err.code === 'InvalidParameterException') {
          throw this.err.unprocessable('Phone number must be valid and in format +[country code][number]');
        }
        throw err;
      })
      .then(() => this.userPool.getCognito().adminSetUserSettings({
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
    return this.userPool.getCognito().verifyUserAttribute({
      AccessToken: token,
      Code: code,
      AttributeName: 'phone_number',
    }).promise()
      .then(() => null);
  }
}

export default Auth;
