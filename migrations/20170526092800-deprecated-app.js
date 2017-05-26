'use strict';

const migrate = require('../scripts/migrate-sql');

exports.up = db => migrate.migrate(db, '20170526092800-deprecated-app.sql');
