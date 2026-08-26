/**
 * WCO Backend - Jest configuration.
 *
 * Unit tests run in isolation (no infra). Integration tests boot the real
 * Express app with an injected in-memory Prisma/Redis stub (hermetic);
 * specs that require live Postgres/Redis are skipped unless
 * RUN_INTEGRATION_TESTS=true.
 *
 * moduleNameMapper strips the `.js` suffix from relative specifiers - the
 * source is authored with Node16-style ESM extensions (required by tsx and
 * esbuild) while ts-jest compiles to CommonJS where those extensions do not
 * resolve on their own.
 */
module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: 'tests/.*\\.(spec|test)\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleNameMapper: {
    // Workspace packages ship raw TypeScript (main -> src/index.ts). Map them
    // to source directly so ts-jest transforms them instead of Jest treating
    // them as prebuilt node_modules code.
    '^@wco/(.*)$': '<rootDir>/../../packages/$1/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/worker.ts', '!src/**/*.d.ts'],
  coverageDirectory: './coverage',
  testTimeout: 15000,
  clearMocks: true,
};
