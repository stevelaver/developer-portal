
class Repository {
  constructor(Services, db, env, err) {
    this.Services = Services;
    this.db = db;
    this.ecr = Services.getECR();
    this.Identity = Services.getIdentity();
    this.env = env;
    this.err = err;
    this.sts = Services.getSTS();
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
            'ecr:GetDownloadUrlForLayer',
            'ecr:PutImage',
            'ecr:InitiateLayerUpload',
            'ecr:UploadLayerPart',
            'ecr:CompleteLayerUpload',
            'ecr:BatchCheckLayerAvailability',
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
        repoType: 'aws-ecr',
        repoUri: null,
        repoTag: null,
        repoOptions: null,
      }, appId, user))
      .then(() => null);
  }

  get(appId, vendor, user) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(appId, vendor))
      .then(() => this.sts.assumeRole({
        RoleSessionName: this.getRoleName(),
        RoleArn: `arn:aws:iam::${this.env.ACCOUNT_ID}:role/${this.getRoleName()}`,
        Policy: this.getRolePolicy(appId),
      }).promise())
      .then((res) => {
        const ecr = this.Services.getECR({
          accessKeyId: res.Credentials.AccessKeyId,
          secretAccessKey: res.Credentials.SecretAccessKey,
          sessionToken: res.Credentials.SessionToken,
        });
        return ecr.getAuthorizationToken().promise();
      });
  }
}

export default Repository;
