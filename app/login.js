
class Login {
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

  login(moment, email, password) {
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
}

export default Login;
