# Onboarding — Code Review Guide

How to submit high-quality PRs and review others'. Full process: [Code review process](../developer/07-code-review-process.md) and [Contributing guide](../developer/12-contributing-guide.md).

## Before you open a PR (author checklist)
- [ ] Branch from up-to-date `main`; short-lived branch.
- [ ] Self-review your own diff first.
- [ ] CI green locally: `npm run lint && npm run typecheck && npm run test`.
- [ ] Tests for all new code (see [Testing guide](./05-testing-guide.md)).
- [ ] Documentation updated (README/ADR/API spec) in the same PR.
- [ ] No commented-out code, no `console.log`/`debugger`, no secrets.
- [ ] Feature flagged if user-facing and incomplete.

## PR requirements
- **Linked issue** (JIRA ticket) + title `[JIRA-XXX] Short description`.
- **Description** per the [PR template](../CONTRIBUTING.md#pr-template): what / why / how-tested / screenshots.
- **Size** < 400 lines changed (exclude generated/lockfiles).
- **2 approvals** required for `auth/**`, `payments/**`, `migrations/**`, `security/**`; 1 elsewhere (CODEOWNERS routes).

## Review SLAs

| Priority | First response | Completion |
|---|---|---|
| Hotfix to prod | 15 min | same day |
| Blocking another team | 4h | 1 day |
| Normal | next business day | 2 days |

## What reviewers look for (priority order)
1. **Correctness** — does it do what it claims, incl. edge cases?
2. **Security** — authn/authz, input validation, tenancy, no injection/secrets.
3. **Performance** — no N+1, indexing, non-blocking.
4. **Readability** — naming, structure.
5. **Style** — defer to Prettier/ESLint (never a human nitpick).

## Reviewer do's & don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Ask questions / request changes when needed | Nitpick formatting |
| Use inline suggestions | Approve out of politeness |
| Check tests cover the change | Merge missing critical-path tests |
| Verify tenancy & event patterns | Skip security-sensitive diffs |

## Merge
- **Squash and merge** (never merge commits). Resolve conflicts first. Monitor the deploy after merge.

## Conflict resolution
Disagreements escalate: engineer ↔ reviewer → squad tech lead → cross-squad RFC in `docs/adr/`. Decisions documented, never hallway-resolved.
