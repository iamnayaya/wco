# ADR-003: Store-scoped tenancy with Postgres RLS-ready schema

- **Status:** Accepted
- **Date:** 2026-01

## Context

Multi-tenant SaaS where a merchant (company) owns stores, and every business row hangs off a store. Cross-tenant data leaks are existential. Options: separate DB per tenant, schema per tenant, shared schema + row scoping.

## Decision

**Shared schema; every tenant-owned table carries `storeId`; all queries go through repositories/guards that inject `storeId` from `TenantContext`.** Row-Level Security policies are defined in the schema for defense-in-depth and can be switched on without app changes.

## Rationale

- One connection pool, one migration path — operational simplicity beats isolation theater at our stage.
- Prisma doesn't natively set session variables per request cheaply; application-level scoping via guards is the pragmatic layer today, with RLS as the safety net when we enable pooled session pinning.

## Consequences

+ Single migration pipeline; cross-store analytics are plain SQL.
+ Leaks require *two* mistakes (missing guard AND missing policy), not one.
− Every new table must carry `storeId` + an index on it — enforced by PR checklist and a lint rule over the Prisma schema.
− Per-tenant noisy-neighbor risk → mitigated by PgBouncer statement pooling and per-store rate limits.
