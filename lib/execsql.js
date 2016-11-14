'use strict';

const _ = require('lodash');
const fs = require('fs');

function exec(conn, sql, callback) {
  conn.query(sql, (err, resIn) => {
    let res = resIn;
    if (!_.isArray(res)) {
      res = [res];
    }
    callback(err, res);
  });
  return this;
}

function execFile(conn, filename, callback) {
  fs.readFile(filename, 'utf8', (err, data) => {
    if (err) {
      throw err;
    }
    exec(conn, data, callback);
  });
  return this;
}

exports.exec = exec;
exports.execFile = execFile;
