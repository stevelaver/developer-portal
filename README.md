## keboola-developer-portal

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/keboola/developer-portal.svg?branch=master)](https://travis-ci.org/keboola/developer-portal)

Application based on Serverless framework utilizing AWS Lamda, API Gateway and Cognito services.



### Installation

1. Install Serverless 1.0 rc: `npm install -g serverless@1.0.0-rc.1`
2. Checkout git repository: `git clone git@github.com:keboola/developer-portal.git`
3. Cd into directory: `cd developer-portal`
4. Install npm dependencies: `npm install` and dev dependencies `npm install --only=dev`
5. Install AWS CLI (e.g. `pip install awscli` on Mac)
6. Setup sender of emails, verify the address and save it to `env.yml`:
 
        aws ses verify-email-identity \
            -- email-address <value>
 
7. Create Cognito User Pool and save it's id and arn to `env.yml`: 

        aws cognito-idp create-user-pool \
            --pool-name <value> \
            --policies PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false} \
            --email-configuration <SES verified email ARN>
        
8. Add attribute to Cognito User Pool:

         aws cognito-idp add-custom-attributes \
            --user-pool-id <value> \
            --custom-attributes Name=isAdmin,AttributeDataType=integer,DeveloperOnlyAttribute=false,Mutable=true,Required=false,NumberAttributeConstraints={MinValue=0,MaxValue=1}
        
9. Create Cognito User Pool Client and save it's id to `env.yml`:

        aws cognito-idp create-user-pool-client \
            --user-pool-id <value> \
            --client-name <value> \
            --no-generate-secret \
            --read-attributes "custom:isAdmin" \
            --write-attributes "profile" \
            --explicit-auth-flows ADMIN_NO_SRP_AUTH

10. Create Myql 5.7 RDS and save credentials to `env.yml`, e.g.:

        aws rds create-db-instance \
            --allocated-storage 1 \
            --db-name <value> \
            --db-instance-dientifier <value> \
            --db-instance-class <value> \
            --engine mysql \
            --engine-version 5.7 \
            --master-username <value> \
            --master-user-password <value> \
            --publicly-accessible true
        
11. Create `env.yml` file with following configuration:

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
        LOG_HOST: logs.papertrailapp.com
        LOG_PORT: 

12. Deploy all resources using command `sls deploy`

13. Run `node scripts/setup-log-subscriber.js <logger-function-arn>` to setup logging