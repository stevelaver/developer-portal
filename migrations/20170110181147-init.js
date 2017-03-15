'use strict';
const migrate = require('../scripts/migrate-sql');
exports.up = (db) => migrate.migrate(db, '20170110181147-init.sql');
