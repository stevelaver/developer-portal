## keboola-developer-portal

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/keboola/developer-portal.svg?branch=master)](https://travis-ci.org/keboola/developer-portal)

Application based on Serverless framework utilizing AWS Lamda, API Gateway and Cognito services.



### Installation

The installation process creates VPC, S3 bucket, Cognito User Pool, RDS instance,
Cloudfront distribution, Lambda functions and API Gateway. All resources are
prefixed with `SERVICE_NAME` variable. Please ensure that the prefix is unique,
if resources with same identifiers already exist, the installation will fail.

The application can be installed only to AWS region supporting all required services. You should be safe to install in regions: Northern Virginia, Oregon and Ireland.

1. Install Serverless: `npm install -g serverless/serverless`
2. Install AWS CLI (e.g. `pip install awscli` on Mac)
3. Install Yarn (see https://yarnpkg.com/en/docs/install)
4. Download git repository: `git clone git@github.com:keboola/developer-portal.git`
5. Cd into directory: `cd developer-portal`
6. Install dependencies: `yarn install`
7. Setup Slack channel for notifications about users and apps approval requirements and create incoming webhook
8. Either save AWS credentials to `~/.aws/credentials` (see http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html#cli-multiple-profiles) or set env variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` prior to running following commands
9. Verify email sender. Run `node scripts/setup.js register-email <region> <email>` and confirm link from the email you get
10. Run setup script: `env SERVICE_NAME= REGION= KEBOOLA_STACK= RDS_PASSWORD= RDS_INSTANCE_CLASS= SES_EMAIL_FROM= STAGE= LOG_HOST= LOG_PORT= SLACK_HOOK_URL= make install`
  - The script will put created identifiers to file `env.yml`
  - Required env variables:
    - `SERVICE_NAME` - Name of the Serverless service. It will be used as a prefix for created AWS services, it should be only alphanumeric with optional dashes
    - `REGION` - AWS region where the services should be created
    - `KEBOOLA_STACK` - KeboolaStack identifier like `martin-developer-portal`
    - `RDS_PASSWORD` - Desired password for created database
    - `RDS_INSTANCE_CLASS` - Desired instance class of created RDS, see http://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html but `db.t2.micro` should work fine
    - `SES_EMAIL_FROM` - Email address used as a sender for emails
    - `STAGE` - Stage of the service (`dev`, `test`, `prod`)
    - `LOG_HOST` - Papertrail endpoint hostname
    - `LOG_PORT` - Papertrail endpoint port
    - `SLACK_HOOK_URL` - Slack webhook url for notifications
11. Save generated `env.yml` to a safe place

Please note that your SES service must be out of sandbox or you have to verify
each email or domain before you use it for account signup.

### Initialization

You should create at least one vendor manually in database table `vendors` before creating users.

You can set created user as admin using command: `node scripts/setup-admin.js <email> enable`


### Run functional tests

1. Look to `env.yml` for `API_ENDPOINT` and create user. Confirm email and enable user in Cognito console
2. Run `env FUNC_USER_EMAIL=<userEmail> FUNC_USER_PASSWORD=<userPass> FUNC_VENDOR=<vendorId> mocha --timeout 0 test/functional`


### Stack update

1. Install according to steps 1-5 in the Installation section
2. Get the `env.yml` file saved from installation and put it to the directory
3. Run `sls deploy`

### Cleanup

1. Install according to steps 1-5 in the Installation section
2. Get the `env.yml` file saved from installation and put it to the directory
3. Run `make remove` to remove all resources from AWS

### Configuration File

Whole configuration is held in `env.yml` which contains these parameters:
```
SERVICE_NAME: dev-portal
KEBOOLA_STACK: dev-portal
REGION: eu-west-1
STAGE: dev
SES_EMAIL_FROM: dev-portal@test.com
RDS_INSTANCE_CLASS: db.t2.micro
RDS_DATABASE: devportal
RDS_USER: devportal
RDS_PASSWORD: dbpass
S3_BUCKET: dev-portal-resources
LOG_HOST: logs.papertrailapp.com
LOG_PORT: 33333
SLACK_HOOK_URL: 'https://hooks.slack.com/services/...'
ACCOUNT_ID: '061240556736'
VPC_CF_STACK_ID: 'arn:aws:cloudformation:eu-west-1:061240556736:stack/dev-portal-vpc/...'
VPC_SECURITY_GROUP: sg-d8b9d5be
RDS_SECURITY_GROUP: sg-d8b9d5be
VPC_SUBNET1: subnet-b05f7ac6
VPC_SUBNET2: subnet-b84360dc
RDS_SUBNET_GROUP: dev-portal-vpc-devportaldbsubnetgroup
COGNITO_POOL_ID: eu-west-1_xxx
COGNITO_CLIENT_ID: 24q0k67ocvs9t56961gahjgd64
RDS_HOST: dev-portal-rds.cptjrpubo0om.eu-west-1.rds.amazonaws.com
RDS_PORT: 3306
CLOUDFRONT_URI: dttajxboh9b9k.cloudfront.net
API_ENDPOINT: 'https://1puon0n5y2.execute-api.eu-west-1.amazonaws.com/dev'
PROFILE: dev
WARMUP_ENABLED: true
```

### Lambda Warm Up

If you change variable `WARMUP_ENABLED` in `env.yml` to `true`, a CloudWatch schedule will be enabled to keep lambda functions for public resources warmed up using 15 minutes ping. 

### CI and deployment

CI is configured on Travis, see https://travis-ci.org/keboola/developer-portal. Deployment is run automatically after releasing a version on GitHub. Travis uses special AWS IAM user with restricted rights in production account. See `iam-user-template.json` for details.  