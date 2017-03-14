'use strict';

const migrate = require('../scripts/migrate-sql');

const migrationName = '20170313170149-add-vendor-is-approved';
exports.up = (db) => migrate.migrate(db, `${migrationName}-up.sql`);
exports.down = (db) => migrate.migrate(db, `${migrationName}-down.sql`);
