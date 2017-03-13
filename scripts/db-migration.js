'use strict';

const dbMigrate = require('db-migrate');
require('db-migrate-mysql');
const yaml = require('yamljs');

const env = yaml.load(`${__dirname}/../env.yml`);

const dbm = dbMigrate.getInstance(true, {
  config: {
    defaultEnv: 'current',
    current: {
      driver: 'mysql',
      user: env.RDS_USER,
      password: env.RDS_PASSWORD,
      host: env.RDS_HOST,
      database: env.RDS_DATABASE,
      port: env.RDS_PORT,
      ssl: 'Amazon RDS',
      multipleStatements: true,
    },
  },
});

const args = process.argv.slice(2);
if (args[0] === 'create') {
  dbm.create(args[1])
    .then(res => console.log(res))
    .catch(err => console.error(err.message))
    .then(() => process.exit());
} else {
  dbm.up()
    .then(res => console.log(res))
    .catch(err => console.error(err.message))
    .then(() => process.exit());
}