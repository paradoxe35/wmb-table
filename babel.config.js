/* eslint global-require: off, import/no-extraneous-dependencies: off */

const developmentEnvironments = ['development', 'test'];

// @ts-ignore
const developmentPlugins = [require('@babel/plugin-transform-runtime')];

const productionPlugins = [
  // @ts-ignore
  require('babel-plugin-dev-expression'),

  // babel-preset-react-optimize
  // @ts-ignore
  require('@babel/plugin-transform-react-constant-elements'),
  // @ts-ignore
  require('@babel/plugin-transform-react-inline-elements'),
  // @ts-ignore
  require('babel-plugin-transform-react-remove-prop-types'),
];

// @ts-ignore
module.exports = (api) => {
  // See docs about api at https://babeljs.io/docs/en/config-files#apicache

  const development = api.env(developmentEnvironments);

  return {
    env: {
      development: {
        compact: false,
      },
    },
    presets: [
      // @babel/preset-env will automatically target our browserslist targets
      // @ts-ignore
      require('@babel/preset-env'),
      // @ts-ignore
      require('@babel/preset-typescript'),
      // @ts-ignore
      [require('@babel/preset-react'), { development }],
    ],
    plugins: [
      // Stage 0
      // @ts-ignore
      require('@babel/plugin-proposal-function-bind'),

      // Stage 1
      // @ts-ignore
      require('@babel/plugin-proposal-export-default-from'),
      // @ts-ignore
      require('@babel/plugin-proposal-logical-assignment-operators'),
      // @ts-ignore
      [require('@babel/plugin-proposal-optional-chaining'), { loose: false }],
      [
        // @ts-ignore
        require('@babel/plugin-proposal-pipeline-operator'),
        { proposal: 'minimal' },
      ],
      [
        // @ts-ignore
        require('@babel/plugin-proposal-nullish-coalescing-operator'),
        { loose: false },
      ],
      // @ts-ignore
      require('@babel/plugin-proposal-do-expressions'),

      // Stage 2
      // @ts-ignore
      [require('@babel/plugin-proposal-decorators'), { legacy: true }],
      // @ts-ignore
      require('@babel/plugin-proposal-function-sent'),
      // @ts-ignore
      require('@babel/plugin-proposal-export-namespace-from'),
      // @ts-ignore
      require('@babel/plugin-proposal-numeric-separator'),
      // @ts-ignore
      require('@babel/plugin-proposal-throw-expressions'),

      // Stage 3
      // @ts-ignore
      require('@babel/plugin-syntax-dynamic-import'),
      // @ts-ignore
      require('@babel/plugin-syntax-import-meta'),
      // @ts-ignore
      [require('@babel/plugin-proposal-class-properties'), { loose: true }],
      // @ts-ignore
      require('@babel/plugin-proposal-json-strings'),

      ...(development ? developmentPlugins : productionPlugins),
    ],
  };
};
