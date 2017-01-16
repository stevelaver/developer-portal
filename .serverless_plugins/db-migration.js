'use strict';
const dbMigrate = require('db-migrate');

class DbMigration {
  constructor() {
    this.commands = {
      deploy: {
        lifecycleEvents: [
          'functions'
        ]
      },
    };
    this.hooks = {
      'after:deploy:deploy': this.afterDeploy
    };
  }

  afterDeploy() {
    const dbm = dbMigrate.getInstance(true);
    return dbm.up();
  }
}

module.exports = DbMigration;