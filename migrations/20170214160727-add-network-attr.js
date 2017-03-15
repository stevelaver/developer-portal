'use strict';
const migrate = require('../scripts/migrate-sql');
exports.up = (db) => migrate.migrate(db, '20170214160727-add-network-attr.sql');
