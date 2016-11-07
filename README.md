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
3. Download git repository: `git clone git@github.com:keboola/developer-portal.git`
4. Cd into directory: `cd developer-portal`
5. Install npm dependencies: `npm install` and dev dependencies `npm install --only=dev`
6. Setup Slack channel for notifications about users and apps approval requirements and create incoming webhook
7. Verify email sender. Run `node scripts/setup.js register-email <region> <email>` and confirm link from the email you get
8. Run setup script: `env SERVICE_NAME= REGION= RDS_PASSWORD= RDS_INSTANCE_CLASS= SES_EMAIL_FROM= STAGE= LOG_HOST= LOG_PORT= SLACK_HOOK_URL= make install`
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
    - `SLACK_HOOK_URL` - Slack webhook url for notifications
9. Save generated `env.yml` to a safe place

Please note that your SES service must be out of a sandbox or you have to verify
each email or domain before you use it for account signup.

### Import from KBC Components API

Optionally you can import data from KBC:

1. download `https://connection.keboola.com/admin/manage-apps/apis-list` to a file
2. run `node scripts/import.js data <path-to-the-file.json>` to load data to db
3. run `node scripts/import.js icons <path-to-the-file.json>` to get app icons and upload to s3
4. run `node scripts/import.js vendors <path-to-the-file.sql>` to fill default vendors (sql should contain inserts to vendors table)

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
