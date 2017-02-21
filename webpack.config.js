const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = {
  entry: {
    admin: ['babel-polyfill', './lambda/admin.js'],
    apps: ['babel-polyfill', './lambda/apps.js'],
    auth: ['babel-polyfill', './lambda/auth.js'],
    authEmails: ['babel-polyfill', './lambda/authEmails.js'],
    icon: ['babel-polyfill', './lambda/icon.js'],
    logger: ['babel-polyfill', './lambda/logger.js'],
    public: ['babel-polyfill', './lambda/public.js'],
    // repositories: ['babel-polyfill', './lambda/repositories.js'],
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
