'use strict';

const migrate = require('../scripts/migrate-sql');

exports.up = db => migrate.migrate(db, '20170811155100-users.sql');
