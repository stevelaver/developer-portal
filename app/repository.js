
class Repository {
  constructor(Services, db, env, err) {
    this.services = new Services(env);
    this.db = db;
    this.ecr = this.services.getECR();
    this.Identity = Services.getIdentity();
    this.env = env;
    this.err = err;
    this.sts = this.services.getSTS();
    this.base64 = Services.getBase64();
  }

  getRoleName() {
    return `${this.env.SERVICE_NAME}-ecr-role`;
  }

  getRepositoryName(appId) {
    return `${this.env.SERVICE_NAME}/${appId}`;
  }

  getRolePolicy(appId) {
    return JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:BatchDeleteImage',
            'ecr:BatchGetImage',
            'ecr:CompleteLayerUpload',
            'ecr:DescribeImages',
            'ecr:GetDownloadUrlForLayer',
            'ecr:InitiateLayerUpload',
            'ecr:ListImages',
            'ecr:PutImage',
            'ecr:UploadLayerPart',
          ],
          Resource: `arn:aws:ecr:${this.env.REGION}:${this.env.ACCOUNT_ID}:repository/${this.getRepositoryName(appId)}`,
        },
        {
          Effect: 'Allow',
          Action: [
            'ecr:GetAuthorizationToken',
            //'cloudwatchlogs:*',
          ],
          Resource: '*',
        },
      ],
    });
  }

  create(appId, vendor, user) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(appId, vendor))
      .then(() => this.ecr.createRepository({
        repositoryName: this.getRepositoryName(appId),
      }).promise())
      .catch((err) => {
        if (err.name !== 'RepositoryAlreadyExistsException') {
          throw err;
        }
      })
      .then(() => this.db.updateApp({
        repoType: 'ecr',
        repoUri: null,
        repoTag: null,
        repoOptions: null,
      }, appId, user.email))
      .then(() => null);
  }

  getCredentials(appId, vendor, user) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(appId, vendor))
      .then(() => this.sts.assumeRole({
        RoleSessionName: this.getRoleName(),
        RoleArn: `arn:aws:iam::${this.env.ACCOUNT_ID}:role/${this.getRoleName()}`,
        Policy: this.getRolePolicy(appId),
      }).promise())
      .then((res) => {
        const ecr = this.services.getECR({
          accessKeyId: res.Credentials.AccessKeyId,
          secretAccessKey: res.Credentials.SecretAccessKey,
          sessionToken: res.Credentials.SessionToken,
        });
        return ecr.getAuthorizationToken().promise();
      })
      .then(data => this.base64.decode(data.authorizationData[0].authorizationToken).split(':'))
      .then(token => ({
        registry: `https://${this.env.ACCOUNT_ID}.dkr.ecr.${this.env.REGION}.amazonaws.com`,
        credentials: {
          username: token[0],
          password: token[1],
        },
      }));
  }
}

export default Repository;
