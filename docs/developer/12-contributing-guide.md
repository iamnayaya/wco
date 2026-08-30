# Contributing Guide

Thank you for contributing to WCO! This page summarizes the engineering contribution process. The authoritative, detailed document is [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Code of conduct

We're committed to a welcoming, inclusive environment. All contributors must follow the [Code of Conduct](../CONTRIBUTING.md#code-of-conduct).

## Quick start

```bash
git clone https://github.com/anomalyco/wco.git && cd wco
npm install
npm run prepare            # husky hooks
cp .env.example .env
npm run docker:up
npm run db:migrate && npm run db:seed
npm run dev
```

See [Development environment setup](./04-development-environment-setup.md) for full details.

## Contribution workflow

1. **Find or create an issue** (link a JIRA ticket).
2. **Create a branch** from an up-to-date `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/JIRA-123-short-desc
   ```
3. **Implement** following the [Code style guide](./05-code-style-guide.md).
4. **Write tests** — all new code must be tested ([Testing guide](./08-testing-guide.md)).
5. **Verify locally**:
   ```bash
   npm run lint && npm run typecheck && npm run test
   ```
6. **Open a PR** using the [PR template](../CONTRIBUTING.md#pr-template). Title: `[JIRA-XXX] Short description`.
7. **Get approval** (per [Code review process](./07-code-review-process.md)) and merge (squash).

## What makes a great PR

- Small (<400 lines), focused on one concern.
- Tested, with new tests for changed code.
- Self-reviewed before requesting review.
- Documentation updated in the same PR (README / ADR / API spec).
- No commented-out code, no `console.log`/`debugger`, no secrets.

## Documentation standards

- **JSDoc/TSDoc** on public APIs and complex functions.
- **README** per package/module.
- **ADR** for significant decisions (`docs/adr/`).
- **OpenAPI** updates for any API change (must pass the `oasdiff` gate).

Documentation is a first-class deliverable — see the [Documentation README](../README.md).

## Security guidelines

- **Never commit** secrets, PII, private keys, or real user data.
- Validate inputs at all boundaries; parameterized queries; enforce authz per resource.
- PRs touching `auth/**`, `payments/**`, `migrations/**`, or `security/**` need 2 approvals and a security review.
- Run `npm audit` / `snyk test` (also in CI).

## Performance guidelines

- **Frontend:** bundle < 200KB initial JS; LCP < 2.5s; code-split; lazy-load images.
- **Backend:** p95 < 200ms; caching via Redis; cursor pagination; async background jobs.
- **Database:** index foreign keys/query columns; reversible, tested migrations; deterministic seeds.

## Recognition

Contributors are recognized in release notes, the contributors page, and annual contributor awards. Build code you're proud of.

Next: [Changelog](./13-changelog.md).
