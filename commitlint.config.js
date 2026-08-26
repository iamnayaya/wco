module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert', 'security'],
    ],
    'scope-enum': [
      1,
      'always',
      ['api', 'auth', 'payments', 'logistics', 'ai', 'frontend', 'mobile', 'admin', 'infra', 'db', 'deps', 'release'],
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'body-max-line-length': [1, 'always', 120],
  },
};