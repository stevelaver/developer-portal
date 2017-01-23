
class Repository {
  constructor(db, ecr, aws, Identity, env, err) {
    this.db = db;
    this.ecr = ecr;
    this.aws = aws;
    this.Identity = Identity;
    this.env = env;
    this.err = err;
  }

  getRoleName() {
    return `${this.env.SERVICE_NAME}_ecr_role`;
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
            'ecr:GetAuthorizationToken',
            'ecr:BatchCheckLayerAvailability',
            'cloudwatchlogs:*',
          ],
          Resource: `arn:aws:ecr:${this.env.REGION}:${this.env.ACCOUNT_ID}:repository/${this.getRepositoryName(appId)}`,
        },
      ],
    });
  }

  create(id, vendor, user) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
      .then(() => this.ecr.createRepository({
        repositoryName: this.getRepositoryName(id),
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
      }, id, user))
      .then(() => null);
  }

  get(sts, id, vendor, user) {
    return this.Identity.checkVendorPermissions(user, vendor)
      .then(() => this.db.checkAppAccess(id, vendor))
      .then(() => sts.assumeRole({
        RoleSessionName: this.getRoleName(),
        RoleArn: `arn:aws:iam::${this.env.ACCOUNT_ID}:role/${this.getRoleName()}`,
        Policy: this.getRolePolicy(id),
      }).promise())
      .then((res) => {
        const ecr = new this.aws.ECR({
          region: this.env.REGION,
          credentials: {
            accessKeyId: res.Credentials.AccessKeyId,
            secretAccessKey: res.Credentials.SecretAccessKey,
            sessionToken: res.Credentials.SessionToken,
          },
        });
        return ecr.getAuthorizationToken().promise();
      });
  }
}

export default Repository;
