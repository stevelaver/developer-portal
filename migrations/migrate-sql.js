const fs = require('fs');
const path = require('path');

const MigrateSql = module.exports;

MigrateSql.migrate = (db, Promise, file) => {
  let filePath = path.join(__dirname, 'sqls', file);
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
      if (err) return reject(err);
      console.log('Received data: ' + data);
      resolve(data);
    });
  })
    .then(data => db.runSql(data));
};