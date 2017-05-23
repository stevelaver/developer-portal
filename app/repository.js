
class Repository {
  constructor(Services, db, env) {
    this.services = new Services(env);
    this.db = db;
    this.ecr = this.services.getECR();
    this.access = Services.getAccess(db);
    this.env = env;
    this.err = Services.getError();
    this.sts = this.services.getSTS();
    this.base64 = Services.getBase64();
  }

  getRegistryName() {
    return `${this.env.ACCOUNT_ID}.dkr.ecr.${this.env.REGION}.amazonaws.com`;
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

  getCredentials(appId, vendor, user) {
    const repositoryName = this.getRepositoryName(appId);
    return this.access.checkApp(user, vendor, appId)
      .then(() => this.ecr.describeRepositories({ repositoryNames: [repositoryName] }).promise())
      .catch((err) => {
        if (err.name !== 'RepositoryNotFoundException') {
          throw err;
        }
        return this.ecr.createRepository({ repositoryName }).promise();
      })
      .then(() => this.db.getApp(appId))
      .then((data) => {
        const repoUri = `${this.getRegistryName()}/${this.getRepositoryName(appId)}`;
        if (data.repository.type !== 'ecr' || data.repository.uri !== repoUri) {
          return this.db.updateApp({
            repoType: 'ecr',
            repoUri,
            repoOptions: null,
          }, appId, user.email);
        }
      })
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
        registry: this.getRegistryName(),
        repository: this.getRepositoryName(appId),
        credentials: {
          username: token[0],
          password: token[1],
        },
      }));
  }
}

export default Repository;
