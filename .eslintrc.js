module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    requireConfigFile: false
  },
  rules: {
    // Disable all rules for this simple static site
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-console': 'off'
  },
  ignorePatterns: [
    '*.html',
    '*.css',
    '*.csv',
    'build.js',
    'migration.js'
  ]
};
