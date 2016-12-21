
class Repository {
  constructor(db, ecr, iam, aws, env, err) {
    this.db = db;
    this.ecr = ecr;
    this.iam = iam;
    this.aws = aws;
    this.env = env;
    this.err = err;
  }

  getRoleName(vendor, appId) {
    return `${this.env.SERVICE_NAME}_ecr_${vendor}_${appId}`;
  }

  static getRepositoryName(vendor, appId) {
    return `${vendor}/${appId}`;
  }

  getRepositoryPolicy(role) {
    return JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${this.env.ACCOUNT_ID}:role/${role}`,
          },
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
        },
      ],
    });
  }

  create(vendor, appId, user) {
    return this.db.checkAppAccess(appId, vendor)
      .then(() => this.iam.createRole({
        RoleName: this.getRoleName(vendor, appId),
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
      }).promise())
      .catch((err) => {
        if (err.name !== 'EntityAlreadyExists') {
          throw err;
        }
      })
      .then(() => this.iam.putRolePolicy({
        RoleName: this.getRoleName(vendor, appId),
        PolicyName: `${this.getRoleName(vendor, appId)}_policy`,
        PolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'ecr:GetAuthorizationToken',
              ],
              Resource: ['*'],
            },
          ],
        }),
      }).promise())
      .then(() => this.ecr.createRepository({
        repositoryName: Repository.getRepositoryName(vendor, appId),
      }).promise())
      .catch((err) => {
        if (err.name !== 'RepositoryAlreadyExistsException') {
          throw err;
        }
      })
      .then(() => this.ecr.setRepositoryPolicy({
        repositoryName: Repository.getRepositoryName(vendor, appId),
        policyText: this.getRepositoryPolicy(this.getRoleName(vendor, appId)),
      }).promise())
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
        RoleSessionName: `${this.getRoleName(vendor, appId)}_role`,
        RoleArn: `arn:aws:iam::${this.env.ACCOUNT_ID}:role/${this.getRoleName(vendor, appId)}`,
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
