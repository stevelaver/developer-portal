const nodeExternals = require('webpack-node-externals');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    admin: ['babel-polyfill', './lambda/admin.js'],
    apps: ['babel-polyfill', './lambda/apps.js'],
    auth: ['babel-polyfill', './lambda/auth.js'],
    authEmail: ['babel-polyfill', './lambda/authEmail.js'],
    dbMigration: ['babel-polyfill', './lambda/dbMigration.js'],
    iconUpload: ['babel-polyfill', './lambda/iconUpload.js'],
    logger: ['babel-polyfill', './lambda/logger.js'],
    public: ['babel-polyfill', './lambda/public.js'],
    // repositories: ['babel-polyfill', './lambda/repositories.js'],
  },
  output: {
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: 'migrations', to: 'migrations' },
    ]),
  ],
  target: 'node',
  // devtool: 'source-map',
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
