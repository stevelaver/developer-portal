'use strict';

const _ = require('lodash');
const fs = require('fs');
const yaml = require('yamljs');

const args = process.argv.slice(2);

fs.writeFile(
  args[0],
  yaml.stringify(process.env),
  (err) => {
    if (err) {
      console.error(err);
    } else {
      console.info(`- Env saved to ${args[0]}`);
    }
    process.exit();
  }
);
