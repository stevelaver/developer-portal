const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = {
  entry: {
    admin: ['babel-polyfill', './lambda/admin.js'],
    auth: ['babel-polyfill', './lambda/auth/auth.js'],
    'auth-email': ['babel-polyfill', './lambda/auth/email.js'],
    logger: ['babel-polyfill', './lambda/logger.js'],
    public: ['babel-polyfill', './lambda/public.js'],
    'vendor-apps-approve': ['babel-polyfill', './lambda/vendor/apps/approve.js'],
    'vendor-apps-icons': ['babel-polyfill', './lambda/vendor/apps/icons.js'],
    'vendor-apps-list': ['babel-polyfill', './lambda/vendor/apps/list.js'],
    'vendor-apps-repository': ['babel-polyfill', './lambda/vendor/apps/repository.js'],
    'vendor-apps-update': ['babel-polyfill', './lambda/vendor/apps/update.js'],
    'vendor-apps-versions': ['babel-polyfill', './lambda/vendor/apps/versions.js'],
  },
  output: {
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  target: 'node',
  externals: [nodeExternals({
    modulesFromFile: true,
  })],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['babel'],
        include: __dirname,
        exclude: /node_modules/,
      },
      {
        test: /\.html$/,
        loader: 'mustache',
      },
    ],
  },
};
