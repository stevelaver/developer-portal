
class Repository {
  constructor(db, ecr, iam, aws, env, err) {
    this.db = db;
    this.ecr = ecr;
    this.iam = iam;
    this.aws = aws;
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

  create(vendor, appId, user) {
    return this.db.checkAppAccess(appId, vendor)
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

  get(sts, vendor, appId) {
    return this.db.checkAppAccess(appId, vendor)
      .then(() => sts.assumeRole({
        RoleSessionName: this.getRoleName(),
        RoleArn: `arn:aws:iam::${this.env.ACCOUNT_ID}:role/${this.getRoleName()}`,
        Policy: this.getRolePolicy(appId),
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
