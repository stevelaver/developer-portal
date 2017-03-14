'use strict';

const fs = require('fs');
const path = require('path');

const MigrateSql = module.exports;

MigrateSql.migrate = (db, file) => {
  const filePath = path.join(__dirname, '/../migrations/sqls', file);
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
      if (err) return reject(err);
      console.log(JSON.stringify({
        message: 'Migration processed',
        migration: file,
        sql: data,
      }));
      resolve(data);
    });
  })
    .then(data => db.runSql(data));
};
