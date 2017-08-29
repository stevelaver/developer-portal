'use strict';

const migrate = require('../scripts/migrate-sql');

exports.up = db => migrate.migrate(db, '20170829131900-publishing-requests.sql');
