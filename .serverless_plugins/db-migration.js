'use strict';

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
      this.serverless.cli.log('Migrating database...');
      const functionData = this.serverless.service.getFunction('dbMigration');
      return this.provider
        .request('Lambda', 'invoke', {
          FunctionName: functionData.name,
          InvocationType: 'RequestResponse',
          LogType: 'Tail',
          Payload: null,
        }, process.env.STAGE, process.env.REGION);
    }
  }
}

module.exports = DbMigration;