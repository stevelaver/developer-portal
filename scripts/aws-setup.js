'use script';

const _ = require('lodash');
const async = require('async');
const aws = require('aws-sdk');
const exec = require('child_process').exec;
const yaml = require('yamljs');

const setup = module.exports;

let accountId = null;

setup.saveAccountId = function (cb) {
  exec('aws sts get-caller-identity --output text --query Account', (err, out) => {
    if (err) {
      return cb(`AWS get identity error: ${err}`);
    }
    accountId = _.trim(out);
    console.info(`Account id saved: ${accountId}`);
    return cb(null, accountId);
  });
};

setup.registerEmail = function (region, email, cb) {
  exec(`aws ses verify-email-identity --region ${region} --email-address ${email}`, (err) => {
    if (err) {
      return cb(`SES registration error: ${err}`);
    }
    console.info(`Email registered in SES: ${email}`);
    return cb();
  });
};

setup.createCognitoPool = function (region, name, email, cb) {
  async.waterfall([
    (cb2) => {
      const emailArn = `arn:aws:ses:${region}:${accountId}:identity/${email}`;
      exec(`aws cognito-idp create-user-pool --region ${region} --pool-name ${name} \
        --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
        --email-configuration SourceArn=${emailArn} --auto-verified-attributes email`, (err, out) => {
        if (err) {
          cb2(`Cognito Create Pool error: ${err}`);
        }
        const poolId = JSON.parse(out).UserPool.Id;
        console.info(`Cognito User Pool created: ${poolId}`);
        cb2(null, poolId);
      });
    },
    (poolId, cb2) => {
      exec(`aws cognito-idp add-custom-attributes --region ${region} --user-pool-id ${poolId} \
        --custom-attributes '[{"Name":"isAdmin","AttributeDataType":"Number","DeveloperOnlyAttribute":false,"Mutable":true,"Required": false,"NumberAttributeConstraints":{"MinValue":"0","MaxValue":"1"}}]'`, (err) => {
        if (err) {
          cb2(`Cognito Create Pool error: ${err}`);
        }
        console.info('Attributes to Cognito User Pool added');
        cb2(null, poolId);
      });
    },
    (poolId, cb2) => {
      exec(`aws cognito-idp create-user-pool-client --region ${region} --user-pool-id ${poolId} --client-name ${name} \
        --no-generate-secret --read-attributes "custom:isAdmin" --write-attributes "profile" \
        --explicit-auth-flows ADMIN_NO_SRP_AUTH`, (err, out) => {
        if (err) {
          cb2(`Cognito Create Pool error: ${err}`);
        }
        const clientId = JSON.parse(out).UserPoolClient.ClientId;
        console.info('Cognito User Pool Client created');
        cb2(null, { poolId, clientId });
      });
    },
  ], cb);
};

setup.updateCognitoPool = function (region, poolId, name, stage, cb) {
  const messageHandlerArn = `arn:aws:lambda:${region}:${accountId}:function:${name}-${stage}-authEmailTrigger`;
  exec(`aws cognito-idp update-user-pool --region ${region} --user-pool-id ${poolId} \
        --lambda-config '{"CustomMessage": "${messageHandlerArn}"}'`, (err) => {
    if (err) {
      cb(`Cognito Update Pool error: ${err}`);
    }
    console.info(`Cognito User Pool updated: ${poolId}`);
    cb();
  });
};

setup.createRds = function (region, name, password, instanceClass, cb) {
  exec(`aws rds create-db-instance --region ${region} --allocated-storage 5 --db-name ${name} \
        --db-instance-identifier ${name} --db-instance-class ${instanceClass} --engine mysql \
        --engine-version 5.7 --master-username ${name} --master-user-password ${password} \
        --publicly-accessible`, (err) => {
    if (err) {
      cb(`Create rds error: ${err}`);
    }

    process.stdout.write(`Creating RDS: ${name} `);
    let endpoint = null;
    let retry = 0;
    async.whilst(() => !endpoint && retry < 60, (cb2) => {
      retry += 1;
      setTimeout(() => {
        exec(`aws rds describe-db-instances --region ${region} --db-instance-identifier ${name}`, (err2, out) => {
          if (err2) {
            cb2(`Describing RDS error: ${err2}`);
          }
          process.stdout.write('.');
          const data2 = JSON.parse(out);
          if (_.has(data2, 'DBInstances')) {
            if (data2.DBInstances.length === 1) {
              if (_.has(data2.DBInstances[0], 'Endpoint')) {
                endpoint = data2.DBInstances[0].Endpoint;
              }
            }
          }
          cb2();
        });
      }, 5000);
    }, (err2) => {
      if (err2) {
        cb(err2);
      }
      if (!endpoint) {
        cb(Error(`Waiting for creation of rds ${name} timed-out.`));
      }
      console.info(`RDS created: ${endpoint.Address}:${endpoint.Port}`);
      cb(null, endpoint);
    });
  });
};

setup.subscribeLogs = function (region, service, stage, cb) {
  async.each(_.keys(yaml.load(`${__dirname}/../serverless.yml`).functions), (item, cb2) => {
    if (item !== 'logger') {
      async.waterfall([
        (cb3) => {
          exec(`aws lambda add-permission --region ${region} --function-name ${service}-${stage}-logger \
        --statement-id ${service}-${stage}-${item} --action lambda:InvokeFunction \
        --principal logs.${region}.amazonaws.com`, (err) => {
            if (err) {
              cb3(`Add function ${item} permission error: ${err}`);
            }
            cb3();
          });
        },
        (cb3) => {
          exec(`aws logs put-subscription-filter --region ${region} --filter-pattern  \
          --filter-name LambdaToPapertrail-${service}-${stage} --log-group-name /aws/lambda/${service}-${stage}-${item} \
          --destination-arn arn:aws:lambda:${region}:${accountId}:function:${service}-${stage}-logger`, (err) => {
            if (err) {
              cb3(`Add function ${item} permission error: ${err}`);
            }
            cb3();
          });
        },
      ], cb2);
    } else {
      cb2();
    }
  }, cb);
};

setup.deleteCognitoPool = function (region, id, cb) {
  exec(`aws cognito-idp delete-user-pool --region ${region} --user-pool-id ${id}`, (err) => {
    if (err) {
      cb(`Remove Cognito pool error: ${err}`);
    }

    process.stdout.write(`Cognito Pool ${id} removed`);
    cb();
  });
};

setup.deleteRds = function (region, id, cb) {
  exec(`aws rds delete-db-instance --region ${region} --db-instance-identifier ${id}`, (err) => {
    if (err) {
      cb(`Remove rds error: ${err}`);
    }

    process.stdout.write(`Rds ${id} removed`);
    cb();
  });
};

setup.deleteS3Bucket = function (region, bucket, cb) {
  exec(`aws s3 rm --region ${region} --recursive s3://${bucket}`, (err) => {
    if (err) {
      cb(`Remove s3 bucket error: ${err}`);
    }

    process.stdout.write(`S3 bucket ${bucket} removed`);
    cb();
  });
};

setup.registerCloudFront = function (region, name, bucket, cb) {
  const cloudfront = new aws.CloudFront();
  cloudfront.createDistribution({
    DistributionConfig: {
      CallerReference: name,
      Origins: {
        Items: [
          {
            S3OriginConfig: { OriginAccessIdentity: '' },
            Id: `S3-${bucket}`,
            DomainName: `${bucket}.s3.amazonaws.com`,
          },
        ],
        Quantity: 1,
      },
      Enabled: true,
      DefaultCacheBehavior: {
        TargetOriginId: `S3-${bucket}`,
        TrustedSigners: {
          Enabled: false,
          Quantity: 0,
        },
        ViewerProtocolPolicy: 'https-only',
        ForwardedValues: {
          Cookies: { Forward: 'none' },
          QueryString: false,
          MinTTL: 0,
          MaxTTL: 31536000,
          DefaultTTL: 86400,
          AllowedMethods: {
            Items: ['HEAD', 'GET'],
            CachedMethods: {
              Items: ['HEAD', 'GET'],
              Quantity: 2,
            },
            Quantity: 2,
          },
          Compress: true,
        },
      },
    },
  }, (err, res) => {
    if (err) {
      cb(`Register Cloudfront error: ${err}`);
    }

    process.stdout.write(`Cloudfront registered: ${res.Distribution.DomainName}`);
    cb(null, { id: res.Distribution.Id, uri: res.Distribution.DomainName });
  });
};

setup.deleteCloudFront = function (region, id, cb) {
  const cloudfront = new aws.CloudFront();
  cloudfront.deleteDistribution({ Id: id }, (err) => {
    if (err) {
      cb(`Register Cloudfront error: ${err}`);
    }

    process.stdout.write(`Cloudfront deleted: ${id}`);
    cb();
  });
};
