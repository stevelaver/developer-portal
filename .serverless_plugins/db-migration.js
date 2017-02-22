'use strict';
const dbMigrate = require('db-migrate');
const fs = require('fs');
const yaml = require('yamljs');

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
    if (!process.env.DB_MIGRATE_SKIP) {
      if (!process.env.RDS_HOST && fs.existsSync(`${__dirname}/../env.yml`)) {
        const env = yaml.load(`${__dirname}/../env.yml`);
        process.env.RDS_HOST = env.RDS_HOST;
        process.env.RDS_USER = env.RDS_USER;
        process.env.RDS_PASSWORD = env.RDS_PASSWORD;
        process.env.RDS_DATABASE = env.RDS_DATABASE;
        process.env.RDS_PORT = env.RDS_PORT;
      }
      this.serverless.cli.log('Migrating database...');
      const dbm = dbMigrate.getInstance(true);
      return dbm.up();
    }
  }
}

module.exports = DbMigration;