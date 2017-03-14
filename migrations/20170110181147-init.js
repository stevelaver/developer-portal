'use strict';

const migrate = require('../scripts/migrate-sql');

const migrationName = '20170110181147-init';
exports.up = (db) => migrate.migrate(db, `${migrationName}-up.sql`);
exports.down = (db) => migrate.migrate(db, `${migrationName}-down.sql`);
