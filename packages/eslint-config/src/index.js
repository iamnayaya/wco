/**
 * Shared ESLint presets for all WCO workspaces.
 *
 * Usage in a workspace .eslintrc.js:
 *   module.exports = { extends: ['@wco/eslint-config/node'] };
 */
const base = {
  env: { es2022: true },
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [{ pattern: '@wco/**', group: 'internal', position: 'before' }],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
    'import/no-cycle': 'error',
  },
};

const node = {
  ...base,
  rules: {
    ...base.rules,
    '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    complexity: ['warn', 12],
  },
};

const react = {
  ...base,
  plugins: [...base.plugins, 'react', 'react-hooks', 'jsx-a11y'],
  settings: { react: { version: 'detect' } },
  rules: {
    ...base.rules,
    '@typescript-eslint/no-floating-promises': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};

module.exports = { base, node, react };
