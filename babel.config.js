module.exports = {
  presets: [
    '@babel/react',
    '@babel/preset-typescript',
    ['@babel/preset-env', { targets: { node: 'current' } }]
  ],
  plugins: [
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    [
      '@babel/plugin-proposal-object-rest-spread',
      { loose: true, useBuiltIns: true },
    ],
    ['@babel/plugin-transform-template-literals', { loose: true }],
    '@babel/plugin-transform-object-assign',
    '@babel/plugin-transform-literals',
    '@babel/plugin-transform-arrow-functions',
    '@babel/plugin-transform-block-scoped-functions',
    '@babel/plugin-transform-object-super',
    '@babel/plugin-transform-shorthand-properties',
    '@babel/plugin-transform-computed-properties',
    '@babel/plugin-transform-for-of',
    ['@babel/plugin-transform-spread', { loose: true, useBuiltIns: true }],
    '@babel/plugin-transform-parameters',
    ['@babel/plugin-transform-destructuring', { loose: true, useBuiltIns: true }],
    ['@babel/plugin-transform-block-scoping', { throwIfClosureRequired: false }],
    '@babel/plugin-transform-classes',
    '@babel/plugin-transform-runtime',
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-proposal-optional-chaining',
    ['@babel/plugin-proposal-private-methods', { 'loose': true }],
    ['@babel/plugin-proposal-private-property-in-object', { 'loose': true }],
    '@babel/plugin-syntax-jsx',
    ['@babel/plugin-transform-react-jsx', {
      pragma: 'Horizon.createElement',
      pragmaFrag: 'Horizon.Fragment'
    }],
  ],
};
