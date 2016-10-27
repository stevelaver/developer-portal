const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = {
  entry: {
    admin: ['babel-polyfill', './lambda/admin.js'],
    'apps-approve': ['babel-polyfill', './lambda/apps-approve.js'],
    'apps-icons': ['babel-polyfill', './lambda/apps-icons.js'],
    'apps-list': ['babel-polyfill', './lambda/apps-list.js'],
    'apps-update': ['babel-polyfill', './lambda/apps-update.js'],
    'apps-versions': ['babel-polyfill', './lambda/apps-versions.js'],
    auth: ['babel-polyfill', './lambda/auth.js'],
    'auth-email': ['babel-polyfill', './lambda/auth-email.js'],
    authorizer: ['babel-polyfill', './lambda/authorizer.js'],
    logger: ['babel-polyfill', './lambda/logger.js'],
    public: ['babel-polyfill', './lambda/public.js'],
  },
  output: {
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  target: 'node',
  externals: [nodeExternals()],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['babel'],
        include: __dirname,
        exclude: /node_modules/,
      },
      {
        test: /env\.yml$/,
        loader: 'yml',
      },
      {
        test: /\.html$/,
        loader: 'mustache',
      },
    ],
  },
};
