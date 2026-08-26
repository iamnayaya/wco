# WCO Database Design

> **Status:** v1.0 · Prompt 2 deliverable · Owner: Data Platform guild
>
> PostgreSQL is the system of record. Redis owns volatile state (sessions,
> rate limits, caches). Elasticsearch owns search. ClickHouse/TimescaleDB own
> analytics at scale. Every choice has an ADR and a documented exit path.

---

## 1. Technology layout & responsibilities

| Store | Engine | Owns | Explicitly does NOT own |
|---|---|---|---|
| OLTP | **PostgreSQL 15** (+ `pg_trgm`, `pgcrypto`; TimescaleDB optional in prod) | All relational domain data — 31 tables | Full-text search over chat history |
| Cache / volatile | **Redis 7** | Sessions, rate limits, JWT denylist, entity cache-aside, AI token budgets, distributed locks, BullMQ | Anything that must survive a flush |
| Search | **Elasticsearch 8** | Product search, customer search, conversation history search, autocomplete | Source of truth (reindexable from PG via CDC) |
| Analytics | **TimescaleDB hypertables** (on prod PG) → **ClickHouse** (OLAP) | Time-series events, dashboard aggregations, funnels | Transactional writes |

Why this split: money-movement correctness needs ACID (PG), hot-path latency
needs memory (Redis), merchant-facing discovery needs relevance ranking (ES),
and "sales by day by store" would murder an OLTP engine (columnar stores).

## 2. File map

| Document | Contents |
|---|---|
| [`erd.md`](./erd.md) | Mermaid ERD, full relationship catalog, JOIN/subquery cookbook |
| [`table-reference.md`](./table-reference.md) | Column-level dictionary for all 31 tables + enums |
| [`indexing-strategy.md`](./indexing-strategy.md) | Every index, why it exists, example plans, anti-patterns |
| [`partitioning-sharding.md`](./partitioning-sharding.md) | Monthly partitions, Timescale hypertables, tenant sharding roadmap |
| [`data-lifecycle.md`](./data-lifecycle.md) | Retention matrix, archival pipeline, purge jobs, GDPR/NDPR erasure |
| [`security-compliance.md`](./security-compliance.md) | Roles, RLS policy catalog, encryption, PII vault, compliance mapping |
| [`performance.md`](./performance.md) | PgBouncer, replica routing, query discipline, cache-aside patterns |
| [`redis-elasticsearch.md`](./redis-elasticsearch.md) | Complete Redis key schema; ES index mappings/settings/reindexing |
| [`backup-recovery.md`](./backup-recovery.md) | RPO/RTO targets, PITR, DR runbooks, restore verification drills |

Code lives in `packages/database/`:

```
packages/database/
├── prisma/
│   ├── schema.prisma                          # source of truth (reviewed in PRs)
│   ├── seed.ts                                # idempotent dev/test dataset
│   ├── migrations/
│   │   ├── migration_lock.toml
│   │   ├── 20260201000000_init_full_schema/migration.sql        # UP  — full DDL
│   │   └── 20260201000100_security_rls_functions/migration.sql  # UP  — RLS/roles/functions
│   └── sql/down/
│       ├── 0001_init_full_schema.down.sql                       # DOWN — drop all
│       └── 0002_security_rls_functions.down.sql                 # DOWN — strip hardening
└── src/                                       # repositories (tenant-scoped)
```

Production-only physical layout: `infra/db/postgres/post-migrate.sql`
(partition conversion, retention automation). Local dev parity:
`infra/docker/init-scripts/01-extensions.sql`.

## 3. Conventions (enforced by PR checklist)

1. **Tenancy** — every business row carries `storeId`; merchant-scope rows use
   `merchantId`. Application repositories scope queries from `TenantContext`;
   RLS makes a forgotten WHERE fail closed.
2. **IDs** — `cuid` TEXT generated client-side. No DB sequences for domain
   tables (merge-friendly, URL-safe); only `analytics_events` uses BIGSERIAL.
3. **Money** — `DECIMAL(14,2)` + ISO currency enum. Totals are CHECK-guaranteed
   arithmetically consistent (`orders.total_math_check`).
4. **Time** — `TIMESTAMP(3)` written/read strictly as UTC. All DB roles are
   pinned `timezone = UTC`; Prisma sends UTC ISO-8601. Never use
   `now()`-relative logic client-side without UTC intent.
5. **Naming** — snake_case tables (`@@map`), camelCase columns (Prisma native,
   quoted). Constraint names follow `{table}_{cols}_{fkey|key|idx}` so Prisma
   diffs never fight hand-written SQL.
6. **Deletes** — soft-delete (`deletedAt`) only where audit history matters;
   everything else cascades or restricts per the FK matrix in `erd.md`.
7. **Migrations** — Prisma generates the skeleton; hand-written SQL is allowed
   for what Prisma can't express (partial uniques, trigram indexes, triggers)
   inside numbered migrations. Down scripts pair 1:1 under `prisma/sql/down/`.

## 4. Quickstart

```bash
# local stack (postgres+redis+rabbitmq+clickhouse+elasticsearch)
docker compose -f infra/docker/docker-compose.yml up -d postgres redis

cd packages/database
npm run db:migrate:dev     # apply migrations (dev flow)
npm run db:seed            # idempotent demo dataset
npm run db:studio          # browse data
```

Demo login after seeding: `demo@wco.app` / `Demo1234!`

Rollback (destructive):

```bash
psql "$DATABASE_URL" -f prisma/sql/down/0002_security_rls_functions.down.sql
psql "$DATABASE_URL" -f prisma/sql/down/0001_init_full_schema.down.sql
```

## 5. Schema at a glance

31 tables · 25 enums · 5 domains:

```
Identity & Tenancy : merchants · users · refresh_tokens · api_tokens
Billing            : subscription_plans · subscriptions · payment_methods
Catalog            : stores · categories · products · product_variants
Commerce           : customers · orders · order_items · payments
Logistics          : delivery_providers · deliveries
Messaging          : conversations (= message_threads view) · messages
Growth             : campaigns · campaign_messages · automation_rules
AI                 : ai_configurations · ai_responses · price_suggestions · demand_forecasts
Platform           : analytics_events · daily_store_metrics · outbox_events
                     webhook_subscriptions · audit_logs
```

Volatile-only state (sessions, rate_limits) is deliberately NOT in Postgres —
see [`redis-elasticsearch.md`](./redis-elasticsearch.md).
