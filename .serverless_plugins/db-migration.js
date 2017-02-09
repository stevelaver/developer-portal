'use strict';
const dbMigrate = require('db-migrate');

class DbMigration {
  constructor(serverless) {
    this.serverless = serverless;
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
    this.serverless.cli.log('Migrating database...');
    const dbm = dbMigrate.getInstance(true);
    return dbm.up();
  }
}

module.exports = DbMigration;