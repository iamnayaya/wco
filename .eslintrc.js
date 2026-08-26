module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json'],
  },
  plugins: ['@typescript-eslint', 'import', 'security', 'unicorn'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:import/typescript',
    'plugin:security/recommended',
    'prettier',
  ],
  rules: {
    // TypeScript strictness
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    '@typescript-eslint/no-floating-promises': 'error',
    // Express 4 route handlers are async; errors funnel through asyncHandler
    // wrappers + the global error middleware, so void-return checks misfire.
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    // The no-unsafe-* family fires on every Prisma JSON / Express interop seam;
    // `any` itself stays banned (above) and tsc strict mode owns type safety.
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      // UPPER_CASE covers env keys, queue names, cache-key maps, zod schemas.
      { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      { selector: 'import', format: ['camelCase', 'PascalCase', 'UPPER_CASE'] },
      // Domain-keyed maps: HTTP header casing, provider payload shapes.
      {
        selector: 'objectLiteralProperty',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
        filter: { regex: '[^A-Za-z0-9]', match: false },
      },
      // Names containing `_` follow external conventions (Prisma aggregates
      // _sum/_count/_all, compound uniques storeId_date) - exempt entirely.
      {
        selector: ['objectLiteralProperty', 'objectLiteralMethod'],
        format: null,
        filter: { regex: '_', match: true },
      },
      { selector: 'objectLiteralMethod', format: ['camelCase', 'UPPER_CASE'] },
      // Quoted keys carry wire/domain syntax (RBAC perms "order:write", event types).
      { selector: 'objectLiteralProperty', modifiers: ['requiresQuotes'], format: null },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['PascalCase'] },
    ],

    // Imports
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

    // Security
    'security/detect-object-injection': 'off', // too noisy with validated DTOs
    'security/detect-non-literal-fs-filename': 'warn',
    'no-eval': 'error',
    'no-new-func': 'error',

    // Quality
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    complexity: ['warn', 12],
    'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
    // Controllers keep async signatures even where a branch returns early.
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // Route modules reference methods on controller singletons that are
      // plain closures over module imports (no `this` anywhere) - binding all
      // 70+ call sites would be pure ceremony.
      files: ['**/*.routes.ts'],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
      },
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'max-lines-per-function': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
      },
    },
    {
      files: ['**/*.tsx'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended', 'plugin:jsx-a11y/recommended'],
      settings: { react: { version: 'detect' } },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', '.turbo', 'coverage', '*.config.js'],
};