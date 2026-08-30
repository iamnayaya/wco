# Code Review Process

Code review is the primary quality gate at WCO. It's a shared responsibility between the **author** (who makes the review easy) and the **reviewer** (who evaluates correctness, security, performance, and maintainability — in that order).

## Before you request review (author responsibilities)

1. **Self-review your own diff first.** Read it as if someone else wrote it.
2. Ensure CI is green locally: `npm run lint`, `npm run typecheck`, `npm run test`.
3. Follow the PR template — describe **what / why / how-tested** with screenshots or a loom for UI.
4. Add `// NOTE:` or `// PERF:` comments on non-obvious decisions.
5. Confirm Definition of Done (see [Development workflow](../guides/development-workflow.md)).

## Review SLAs

| Priority | First response | Completion |
|---|---|---|
| Hotfix to prod | 15 min | Same day |
| Blocking another team | 4h | 1 day |
| Normal | Next business day start | 2 days |

## Review assignment (via CODEOWNERS)

- Path-based ownership routes PRs to the right squads automatically.
- Minimum **1 approval**; **2 approvals** required for:
  - `payments/**`
  - `auth/**`
  - `migrations/**`
  - `security/**`
- Reviewer rotation prevents bottlenecks (CODEOWNERS groups round-robin).

## What reviewers evaluate (priority order)

Reviewers apply these lenses **in this order**:

1. **Correctness** — does the code do what it claims, including edge cases?
2. **Security** — authn/authz enforced, inputs validated, no secrets, tenant isolation, no injection.
3. **Performance** — no N+1 queries, sensible indexing, no blocking hot paths.
4. **Readability** — is the intent obvious? Naming, structure.
5. **Style** — Prettier/ESLint territory; **never** a human comment.

### Do / Don't for reviewers

| ✅ Do | ❌ Don't |
|---|---|
| Ask questions, request changes when needed | Nitpick formatting (let Prettier do that) |
| Approve only when confident | Approve out of politeness |
| Use inline suggestions | Demand rewrites without rationale |
| Check the test coverage for new code | Merge PRs with missing tests for critical paths |
| Verify tenancy & event patterns | Skip security-sensitive diffs |

## Author–reviewer interaction

- The author is responsible for the merge and for addressing all feedback.
- Conflict resolution escalates: engineer ↔ reviewer discussion → squad tech lead → cross-squad RFC in `docs/adr/`. Decisions are **documented, never hallway-resolved**.

## Merge

- **Squash and merge** to `develop`/`main` (never merge commits).
- Resolve conflicts before merging.
- After merge, monitor the deploy to the target environment.

## Definition of Done (reminder)

- [ ] Code complete with tests (unit ≥80% changed-lines coverage)
- [ ] Integration test for any API change (Testcontainers-based)
- [ ] Contract tests updated (Pact) if API surface changed
- [ ] Lint + typecheck + all tests green in CI
- [ ] Self-reviewed diff
- [ ] Documentation updated (README, ADR if architectural decision)
- [ ] Feature flagged if user-facing and incomplete
- [ ] Migrations reversible; tested up **and** down
- [ ] Observability added (metrics, structured logs, trace spans)
- [ ] Security checklist passed
- [ ] Product owner acceptance

Next: [Testing guide](./08-testing-guide.md).
