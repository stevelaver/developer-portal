'use strict';

const yaml = require('yamljs');

const env = yaml.load(`${__dirname}/../env.yml`);

class DbMigration {
  constructor(serverless) {
    this.serverless = serverless;
    this.provider = this.serverless.getProvider('aws');
    this.commands = {
      deploy: {
        lifecycleEvents: [
          'functions'
        ]
      },
    };
    this.hooks = {
      'after:deploy:deploy': this.afterDeploy.bind(this),
    };
  }

  afterDeploy() {
    if (!process.env.DB_MIGRATE_SKIP) {
      const functionData = this.serverless.service.getFunction('dbMigration');
      return this.provider
        .request('Lambda', 'invoke', {
          FunctionName: functionData.name,
          InvocationType: 'RequestResponse',
          LogType: 'Tail',
          Payload: null,
        }, env.STAGE, env.REGION);
    }
  }
}

module.exports = DbMigration;