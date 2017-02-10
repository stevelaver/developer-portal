const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = {
  entry: {
    'admin-apps': ['babel-polyfill', './lambda/admin/apps.js'],
    'admin-users': ['babel-polyfill', './lambda/admin/users.js'],
    apps: ['babel-polyfill', './lambda/apps.js'],
    'auth-email': ['babel-polyfill', './lambda/auth/email.js'],
    'auth-login': ['babel-polyfill', './lambda/auth/login.js'],
    'auth-signup': ['babel-polyfill', './lambda/auth/signup.js'],
    icon: ['babel-polyfill', './lambda/icon.js'],
    logger: ['babel-polyfill', './lambda/logger.js'],
    public: ['babel-polyfill', './lambda/public/public.js'],
    'public-apps': ['babel-polyfill', './lambda/public/apps.js'],
    'public-stacks': ['babel-polyfill', './lambda/public/stacks.js'],
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
