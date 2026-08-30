# Knowledge Base: Architecture Decisions

Summaries and rationale for significant WCO architecture decisions. The full, authoritative ADRs are in [`docs/adr/`](../adr/).

## Why we document decisions
Every non-trivial choice is recorded so future engineers understand **why** (not just what), what alternatives were considered, and the trade-offs. This prevents "toggle surprise" and lets us revisit decisions with context.

## Decision index

### ADR-001 — Monorepo: npm workspaces + Turborepo
- **Decision:** npm workspaces + Turborepo over Nx and pnpm.
- **Why:** zero extra runtime deps for contributors (npm ships with Node); Turborepo covers caching + parallel dev without Nx's plugin/generator overhead; Windows-first contributors avoid pnpm symlink friction.
- **Alternatives:** pnpm (speed, dedup), Nx (plugins/generators), Bazel (heavy).
- **Consequence (kept):** larger `node_modules`; escape hatch preserved via workspace protocol.

### ADR-002 — Transactional outbox for async side effects
- **Decision:** state changes emit domain events as outbox rows; a relay publishes to the queue atomically with the DB transaction.
- **Why:** guarantees **no lost or duplicate events** even if the process dies between commit and publish; keeps the DB as source of truth.
- **Consequence:** engineers must **emit events**, never publish directly to the queue from controllers/services. Read the full ADR for the mechanism.

### ADR-003 — Multi-tenant isolation (store-scoped + RLS)
- **Decision:** every business resource is scoped to a store; `TenantContext` guard scopes queries; **Postgres RLS** is the database backstop.
- **Why:** defense-in-depth so even a flawed query or a leaked direct-DB connection can't cross tenants; aligns with our security-by-design principle.
- **Consequence:** **every query touching tenant data must scope by `storeId`** — no exceptions (reviewed in code review).

## How to add a decision
Create a new ADR in `docs/adr/` using the [template](../CONTRIBUTING.md#architecture-decision-records-adr). Include status, context, decision, consequences, and alternatives. Discuss RFCs at [Arch review](../onboarding/08-team-processes.md) before finalizing for significant changes.

## Revisiting decisions
When an ADR's assumptions change:
1. Add a new ADR that **supersedes** the old one (link them).
2. Update affected docs referencing the old decision.
3. Note the change in the changelog.

## Related
- [Technical deep dives](./02-technical-deep-dives.md) — implementation detail behind decisions.
