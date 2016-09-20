## keboola-developer-portal

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/keboola/developer-portal.svg?branch=master)](https://travis-ci.org/keboola/developer-portal)

Application based on Serverless framework utilizing AWS Lamda, API Gateway and Cognito services.



### Installation

1. Install Serverless 1.0 rc: `npm install -g serverless@1.0.0-rc.1`
2. Checkout git repository: `git clone git@github.com:keboola/developer-portal.git`
3. Cd into directory: `cd developer-portal`
4. Install npm dependencies: `npm install` and dev dependencies `npm install --only=dev`
5. AWS Setup (so far has to be manual)
    1. Verify email address used as sender for emails in SES console
        - Save the email to `env.yml` (see below)
    2. Create Cognito User Pool in AWS console
        - Add email sender to `FROM` in section `Verifications`
        - Save Cognito pool id to `env.yml`
        - Create app in section `Apps`
            - Do **not** generate client secret
            - Enable sign-in API for server-based authentication
            - Add `profile` to `Writable Attributes`
            - Save client id to `env.yml`
    3. Create Myql 5.7 RDS
        - Save it's credentials to `env.yml`
6. Create `env.yml` file with following configuration:

        SERVICE_NAME: dev-portal
        REGION: us-east-1
        COGNITO_CLIENT_ID: 
        COGNITO_POOL_ID: 
        COGNITO_POOL_ARN: 
        SES_EMAIL: 
        RDS_HOST: 
        RDS_USER: 
        RDS_PASSWORD: 
        RDS_DATABASE: 
        RDS_SSL: Amazon RDS
        S3_BUCKET_ICONS: 
        ICONS_PUBLIC_FOLDER: 

7. Deploy all resources using command `sls deploy`