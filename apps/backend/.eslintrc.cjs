const path = require('path');

module.exports = {
  extends: '../../.eslintrc.js',
  parserOptions: {
    project: [path.join(__dirname, 'tsconfig.json')],
  },
  ignorePatterns: ['dist', 'coverage', 'node_modules', 'esbuild.config.mjs'],
};
