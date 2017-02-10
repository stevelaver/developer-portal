const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = {
  entry: {
    admin: ['babel-polyfill', './lambda/admin.js'],
    'admin-apps': ['babel-polyfill', './lambda/admin/apps.js'],
    'auth-email': ['babel-polyfill', './lambda/auth/email.js'],
    'auth-login': ['babel-polyfill', './lambda/auth/login.js'],
    'auth-signup': ['babel-polyfill', './lambda/auth/signup.js'],
    logger: ['babel-polyfill', './lambda/logger.js'],
    public: ['babel-polyfill', './lambda/public/public.js'],
    'public-apps': ['babel-polyfill', './lambda/public/apps.js'],
    'public-stacks': ['babel-polyfill', './lambda/public/stacks.js'],
    'vendor-apps-approve': ['babel-polyfill', './lambda/vendor/apps/approve.js'],
    'vendor-apps-icon': ['babel-polyfill', './lambda/vendor/apps/icon.js'],
    'vendor-apps-list': ['babel-polyfill', './lambda/vendor/apps/list.js'],
    'vendor-apps-repository': ['babel-polyfill', './lambda/vendor/apps/repository.js'],
    'vendor-apps-update': ['babel-polyfill', './lambda/vendor/apps/update.js'],
    'vendor-apps-versions': ['babel-polyfill', './lambda/vendor/apps/versions.js'],
    vendors: ['babel-polyfill', './lambda/vendors.js'],
  },
  output: {
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  target: 'node',
  devtool: 'source-map',
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
