## keboola-developer-portal

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/keboola/developer-portal.svg?branch=master)](https://travis-ci.org/keboola/developer-portal)

Application based on Serverless framework utilizing AWS Lamda, API Gateway and Cognito services.



### Installation

The installation process creates S3 bucket, Cognito User Pool, RDS instance,
Cloudfront distribution, Lambda functions and API Gateway. All resources are
prefixed with `SERVICE_NAME` variable. Please ensure that the prefix is unique,
if resources with same identifiers already exist, the installation will fail.

1. Install Serverless 1.0: `npm install -g serverless`
2. Install AWS CLI (e.g. `pip install awscli` on Mac)
3. Checkout git repository: `git clone git@github.com:keboola/developer-portal.git`
4. Cd into directory: `cd developer-portal`
5. Install npm dependencies: `npm install` and dev dependencies `npm install --only=dev`
6. Run setup script: `env SERVICE_NAME= REGION= RDS_PASSWORD= RDS_INSTANCE_CLASS= SES_EMAIL_FROM= STAGE= LOG_HOST= LOG_PORT= make`
  - The script will put created identifiers to file `env.yml`
  - Required env variables:
    - `SERVICE_NAME` - Name of the Serverless service. Will be used as prefix for created AWS services, should be only alphanumeric with optional dashes
    - `REGION` - AWS region where the services should be created
    - `RDS_PASSWORD` - Desired password for created database
    - `RDS_INSTANCE_CLASS` - Desired instance class of created RDS, see http://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html
    - `SES_EMAIL_FROM` - Email address used as sender for emails
    - `STAGE` - Stage of the service (`dev`, `test`, `prod`)
    - `LOG_HOST` - Papertrail endpoint hostname
    - `LOG_PORT` - Papertrail endpoint port
7. Confirm email sender, AWS should send you confirmation request

Optionally you can import data from KBC:
1. download `https://connection.keboola.com/admin/manage-apps/apis-list` to a file
2. run `node scripts/import.js data <path-to-the-file.json>` to load data to db
3. run `node scripts/import.js icons <path-to-the-file.json>` to get app icons and upload to s3

You can set created user as admin using command: `node scripts/setup-admin.js <email> enable`

### Cleanup

1. Run `make remove` to remove all resources from AWS
