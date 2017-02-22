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
      const env = yaml.load(`${__dirname}/../env.yml`),
        config = {
        "defaultEnv": "current",
        "current": {
          "driver": "mysql",
          "user": env.RDS_USER,
          "password": env.RDS_PASSWORD,
          "host": env.RDS_HOST,
          "database": env.RDS_DATABASE,
          "port": env.RDS_PORT,
          "ssl": "Amazon RDS",
          "multipleStatements": true,
          "tunnel": {
            "host": env.BASTION_IP,
            "username": "ec2-user"
          }
        }
      };
      this.serverless.cli.log('Migrating database...');
      const dbm = dbMigrate.getInstance(true, {
        config: config
      });
      return dbm.up();
    }
  }
}

module.exports = DbMigration;