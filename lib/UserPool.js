'use strict';

const _ = require('lodash');

class UserPool {
  constructor(cognito, poolId, clientId, Identity, err, dbUsers) {
    this.cognito = cognito;
    this.poolId = poolId;
    this.clientId = clientId;
    this.Identity = Identity;
    this.err = err;
    this.dbUsers = dbUsers;
  }

  getCognito() {
    return this.cognito;
  }

  getUser(email) {
    return this.cognito.adminGetUser({
      UserPoolId: this.poolId,
      Username: email,
    }).promise()
      .then(data => this.Identity.formatUser(data));
  }

  static formatUser(item) {
    const profile = _.find(item.Attributes, o => (o.Name === 'profile'));
    return {
      email: item.Username,
      name: _.get(_.find(item.Attributes, o => (o.Name === 'name')), 'Value', ''),
      vendors: profile ? _.get(profile, 'Value', '').split(',') : [],
      description: _.get(_.find(item.Attributes, o => (o.Name === 'custom:description')), 'Value', ''),
      createdOn: item.UserCreateDate,
      isEnabled: item.Enabled,
      status: item.UserStatus,
    };
  }

  listUsers(filterIn, paginationToken = null) {
    const params = {
      UserPoolId: this.poolId,
    };
    switch (filterIn) {
      case 'enabled':
        params.Filter = 'status = "Enabled"';
        break;
      case 'disabled':
        params.Filter = 'status = "Disabled"';
        break;
      case 'unconfirmed':
        params.Filter = 'cognito:user_status = "Unconfirmed"';
        break;
      case 'confirmed':
        params.Filter = 'cognito:user_status = "Confirmed"';
        break;
      default:
    }

    if (paginationToken) {
      params.PaginationToken = paginationToken;
    }
    return this.cognito.listUsers(params).promise()
      .then(data => ({
        users: _.map(data.Users, item => UserPool.formatUser(item)),
        paginationToken: data.PaginationToken,
      }));
  }

  listUsersAll(vendor, paginationToken) {
    const params = { UserPoolId: this.poolId, Filter: 'status = "Enabled"' };
    if (paginationToken) {
      params.PaginationToken = paginationToken;
    }
    return this.cognito.listUsers(params).promise()
      .then((data) => {
        const filteredData = _.reduce(data.Users, (result, val) => {
          const formattedVal = UserPool.formatUser(val);
          if (_.includes(formattedVal.vendors, vendor)) {
            result.push(formattedVal);
          }
          return result;
        }, []);
        if (_.has(data, 'PaginationToken')) {
          return filteredData.concat(this.listUsersAll(vendor, data.PaginationToken));
        }
        return filteredData;
      });
  }

  listUsersAllAtOnce(vendor) {
    return this.listUsersAll(vendor)
      .then(res => _.filter(res, 'isEnabled', true));
  }

  listUsersForVendor(vendor, paginationToken) {
    return this.listUsers(null, paginationToken)
      .then(data => ({
        users: _.remove(data.users, user => user.vendors.indexOf(vendor) !== -1),
        paginationToken: data.PaginationToken,
      }))
      .then(data => ({
        users: data.users.map(item => ({
          name: item.name,
          email: item.email,
          description: item.description,
        })),
        paginationToken: data.PaginationToken,
      }));
  }

  updateUserAttribute(email, attribute, value) {
    return this.cognito.adminUpdateUserAttributes({
      UserPoolId: this.poolId,
      Username: email,
      UserAttributes: [
        {
          Name: attribute,
          Value: value,
        },
      ],
    }).promise();
  }

  addUserToVendor(email, vendor) {
    return this.getUser(email)
      .then((user) => {
        if (user.vendors.indexOf(vendor) !== -1) {
          throw this.err.badRequest(`User ${email} is already member of vendor ${vendor}`);
        }
        user.vendors.push(vendor);
        return this.updateUserAttribute(email, 'profile', user.vendors.join(','));
      });
  }

  removeUserFromVendor(email, vendor) {
    return this.getUser(email)
      .then((user) => {
        const pos = user.vendors.indexOf(vendor);
        if (pos !== -1) {
          user.vendors.splice(pos, 1);
          return this.updateUserAttribute(email, 'profile', user.vendors.join(','));
        }
      });
  }

  makeUserAdmin(email) {
    return this.getUser(email)
      .then((data) => {
        if (data.isAdmin) {
          throw this.err.badRequest('The user has been already made admin');
        }
      })
      .then(() => this.updateUserAttribute(email, 'custom:isAdmin', '1'));
  }

  deleteUser(email) {
    return this.cognito.adminDeleteUser({ UserPoolId: this.poolId, Username: email }).promise();
  }

  forgotPassword(email) {
    return this.cognito.forgotPassword({
      ClientId: this.clientId,
      Username: email,
    }).promise();
  }

  confirmForgotPassword(email, password, code) {
    return this.cognito.confirmForgotPassword({
      ClientId: this.clientId,
      ConfirmationCode: code,
      Password: password,
      Username: email,
    }).promise();
  }

  signUp(userName, password, name, description = null, isRealUser = true) {
    const userAttributes = [
      {
        Name: 'name',
        Value: name,
      },
    ];
    if (isRealUser) {
      userAttributes.push({
        Name: 'email',
        Value: userName,
      });
    }
    if (description) {
      userAttributes.push({
        Name: 'custom:description',
        Value: description,
      });
    }
    return this.cognito.signUp({
      ClientId: this.clientId,
      Username: userName,
      Password: password,
      UserAttributes: userAttributes,
    }).promise()
      .then(() => this.dbUsers.createUser({
        id: userName,
        name,
        description,
        serviceAccount: !isRealUser,
      }));
  }

  login(email, password) {
    return this.cognito.adminInitiateAuth({
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      ClientId: this.clientId,
      UserPoolId: this.poolId,
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

  confirmSignUp(email) {
    return this.cognito.adminConfirmSignUp({ UserPoolId: this.poolId, Username: email }).promise();
  }
}

export default UserPool;
