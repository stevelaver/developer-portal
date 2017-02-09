const moment = require('moment');

class Auth {
  constructor(cognito, env, err) {
    this.cognito = cognito;
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
}

export default Auth;
