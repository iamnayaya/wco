# Runbook: Database

Operating the PostgreSQL database: connection health, migrations, performance, locks, and common fixes. Design and schema live in [`docs/database/`](../database/README.md); backup/restore in [Backup & recovery runbook](./04-backup-recovery-runbook.md).

## Prerequisites
- Read-only access to prod DB (or break-glass, audited) — on-call uses **read replicas** where possible.
- `psql` / `pg_dump`, and DB connection URI.

## 1. Health & connection checks

```sql
-- Active connections & database size
SELECT count(*) FROM pg_stat_activity;
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Check for bloat / long-running queries
SELECT pid, now()-query_start AS dur, state, left(query,80)
FROM pg_stat_activity
WHERE state <> 'idle' ORDER BY dur DESC;
```

**Symptom:** connection pool exhausted → clients queue / 5xx. Fix: scale pool (see [Scaling runbook](./05-scaling-runbook.md)), or kill runaway queries (below).

## 2. Slow queries & indexes

1. Find slow queries in monitoring (p95 latency correlated to specific SQL).
2. `EXPLAIN ANALYZE` the query.
3. Check for a missing index — add per [indexing strategy](../database/indexing-strategy.md):

```sql
CREATE INDEX CONCURRENTLY idx_orders_store_created
  ON orders (store_id, created_at DESC);
```

> Use `CONCURRENTLY` to avoid locking writes during index creation. Never run DDL that takes an AccessExclusive lock for long on prod without a plan.

## 3. Kill a hung / runaway query

```sql
-- Find the pid, then cancel:
SELECT pg_cancel_backend(<pid>);      -- soft cancel (graceful)
-- If it doesn't stop, terminate:
SELECT pg_terminate_backend(<pid>);   -- hard kill (rollback)
```
Be sure you terminate the right process (not a critical one) — verify with the query text first.

## 4. Locks & deadlocks

```sql
-- Show blocking locks
SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid,
       left(blocked.query,60) AS blocked_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid));
```
If a transaction holds a lock too long, resolve it (commit/rollback/kill) per the incident flow.

## 5. Migrations

Migrations run via Prisma in the release pipeline (**before** new pods), and are only **backward-compatible** (expand-migrate-contract):

```bash
# Local / dev
npm run db:migrate
# Nightly: migration tests up AND down (`npm run db:reset` uses down)
```
- Never edit an applied migration file in a way that changes applied history.
- A failed migration mid-deploy: stop the rollout, fix migration (new forward migration), re-run, then resume.

See [Deployment guide](../developer/09-deployment-guide.md) and [Deployment runbook](./01-deployment-runbook.md) for the migration window and two-release rule for breaking changes.

## 6. Health of replicas / failover

- Confirm replication lag / replica health on the read replica.
- Failover is automatic with Multi-AZ; if promotion is needed manually, target the designated DR procedure → [DR runbook](./dr.md).

## 7. Space & bloat

```sql
-- Vacuum bloat report (approx: tables with many deleted rows)
SELECT relname, n_dead_tup, n_live_tup
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 20;
```
Autovacuum handles this normally; tune `autovacuum_vacuum_scale_factor` per table only when evidently needed.

## 8. Escalation
- Data corruption, data loss, or restore needed → [Backup & recovery runbook](./04-backup-recovery-runbook.md) + [DR runbook](./dr.md) + incident (S1).
- Performance regression → monitor + index; else back to [Scaling runbook](./05-scaling-runbook.md).
- Users affected → [Incident response runbook](./03-incident-response-runbook.md).
