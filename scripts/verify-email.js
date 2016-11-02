'use strict';

const awsSetup = require('./aws-setup');

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Must have two arguments, region and email');
}

awsSetup.registerEmail(args[0], args[1], (err) => {
  if (err) {
    throw err;
  }
  process.exit();
});
