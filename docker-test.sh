#!/bin/bash

./node_modules/.bin/eslint . \
  && node ./scripts/create-env.js ./env.yml TEST \
  && mocha --timeout 0 --compilers js:babel-core/register test/lib \
  && mocha --timeout 0 --compilers js:babel-core/register test/app \
  && mocha --timeout 0 --compilers js:babel-core/register test/functional