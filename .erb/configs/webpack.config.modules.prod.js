const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
// const CheckNodeEnv = require('../scripts/CheckNodeEnv');
const entry = require('webpack-glob-entry');

// CheckNodeEnv('production');

module.exports = {
  mode: 'production',
  entry: entry(path.resolve(__dirname, '../../modules/*.js')),

  output: {
    path: path.join(__dirname, '../../modules-output'),
    filename: '[name].js',
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve('babel-loader'),
          },
        ],
      },
    ],
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
    ],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
    }),
  ],
};
