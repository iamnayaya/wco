# WCO Indexing Strategy

> Every index must earn its write-amplification cost. Rule of thumb at our
> scale: each additional index on `messages` costs ~2% insert throughput.
> An index without a query behind it gets deleted in index-review weeks.

## 1. Principles

1. **Tenant-first composite ordering** — every tenant table's hot indexes lead
   with `storeId` so the planner can use an index range scan per tenant and
   buffer-cache locality groups one merchant's rows together.
   `(storeId, …)` beats `(… , storeId)` for every query we actually run.
2. **Match the ORDER BY** — cursor pagination (`ORDER BY createdAt DESC`)
   only avoids sort nodes when the index ends with the same column sequence.
3. **Partial > full when a predicate is stable** — e.g., live subscriptions,
   non-soft-deleted products. Smaller trees, hotter cache.
4. **FKs are always indexed** even when Prisma wouldn't — every CASCADE/SET NULL
   delete path otherwise degrades to sequential scans of the child table.
5. **EXPLAIN gate** — any PR touching a repository query must attach
   `EXPLAIN (ANALYZE, BUFFERS)` output; reviewers check for `Seq Scan` on
   tables > 100k rows and unexpected sorts.

## 2. Catalog-by-table (why each exists)

### orders
| Index | Query served | Why composite order matters |
|---|---|---|
| `orders_storeId_status_createdAt_idx` | Inbox list filtered by status tab, newest first | Equality(store), equality(status), sort(createdAt) → pure index scan, zero sort node |
| `orders_storeId_customerId_createdAt_idx` | Customer 360: "all orders from Adaeze" | Covers tenant + customer history pagination |
| `orders_customerId_idx` | FK enforcement + cross-store support lookup by RESTRICT path | Child-side index required for parent deletes |
| UNIQUE `orders_orderNumber_key` | WhatsApp deep-links `/o/WC-7F3K9Q`; idempotent order creation | Also enforces human-readable uniqueness |

**Anti-index deliberately absent:** `orders_status_idx` alone — status has ~7
values; standalone B-tree selectivity is garbage and the planner would ignore it.

### messages (hottest writes)
| Index | Query served |
|---|---|
| UNIQUE `messages_waMessageId_key` | Webhook replay dedupe (Meta retries) |
| `messages_conversationId_createdAt_idx` | Thread view: last N messages, keyset-paginated. This is THE chat query |
| `messages_status_createdAt_idx` | Outbox-style sweeper: QUEUED older than X, retry FAILED |

Write math: 100M msgs/day ≈ 1,160 inserts/s avg, 12k/s peak. Three secondary
indexes keep p99 insert <5ms on r6g.4xl; measured via pgbench in load harness.

### products / product_variants
| Index | Served |
|---|---|
| UNIQUE `(storeId, sku)` | Import/CSV upserts, variant dedupe |
| `(storeId, status)` | Storefront listing (ACTIVE only) |
| `(storeId, name)` | Alphabetical catalog browse |
| GIN trgm `products_name_trgm_idx` (0002) | Fuzzy fallback search when ES is down: `name ILIKE '%ric%'` |
| UNIQUE `(productId, sku)` + `(productId, status)` on variants | Variant picker queries |

### customers
| Index | Served |
|---|---|
| UNIQUE `(storeId, waPhone)` | Identity anchor: webhook → thread → customer resolution on EVERY inbound message |
| `(storeId, totalSpent)` | VIP leaderboard, segment queries |
| `(storeId, lastOrderAt)` | Churn-risk lists ("no order in 60d") |
| GIN trgm `customers_name_trgm_idx`, btree `waPhone text_pattern_ops` (0002) | ES-degraded search fallback |

### payments
UNIQUE `providerReference` (webhook idempotency) · UNIQUE `orderId` (1:1 guard)
· `(storeId, status)` ("pending settlements" finance view).

### deliveries
UNIQUE `orderId` · `(storeId,status)` (ops board columns) · `trackingCode`
(customer "where e dey?" link lookups — near-unique cardinality) ·
`(deliveryProviderId,status)` (provider SLA dashboards).

### conversations
UNIQUE `(storeId,customerId)` (thread identity) · `(storeId,lastMessageAt)`
(inbox ordering = sort match) · `(storeId,status)` (BOT/HANDLED queues).

### subscriptions
`(merchantId)` FK · `(status,currentPeriodEnd)` — renewal cron scans
`WHERE status IN ('ACTIVE','TRIALING') AND currentPeriodEnd < now()+3d`
in one index pass · `trialEndsAt` — trial-expiry reminders · partial UNIQUE
`subscriptions_one_live_per_merchant_uidx WHERE status IN ('ACTIVE','TRIALING')`
— double-billing becomes physically impossible; partial keeps it tiny (~1 row
per merchant).

### audit_logs / analytics_events / outbox_events
Time-led composites: `(storeId,createdAt)`, `(actorUserId,createdAt)`,
`(storeId,type,occurredAt)`, `(occurredAt)`, `(processedAt,createdAt)`.
After prod partitioning these become partition-local indexes — pruning makes
"last 24h" queries touch ≤2 partitions regardless of total history size.

## 3. Worked example: how an index choice shows up in plans

Query — inbox first page:
```sql
SELECT * FROM conversations WHERE "storeId"=$1 ORDER BY "lastMessageAt" DESC LIMIT 25;
```

Without the composite (only PK): `Sort (top-N heapsort) … rows=2_400_000`,
~180ms cold. With `conversations_storeId_lastMessageAt_idx`:
```
Limit (cost=0.56..18.20 rows=25)
  -> Index Scan using conversations_storeId_lastMessageAt_idx
       Index Cond: ("storeId" = $1::text)
Buffers: shared hit=6          -- six pages. sub-ms warm.
```

## 4. Maintenance

* Monthly `pg_stat_user_indexes` review: `idx_scan = 0` over 30d ⇒ propose drop.
* `REINDEX CONCURRENTLY` rotation during low-traffic windows (Tue 03:00 WAT).
* Bloat alerts at >20% dead tuples (autovacuum tuned: `scale_factor=0.05` on
  messages/orders, `autovacuum_vacuum_cost_limit=2000`).
* New tables MUST ship with: storeId column ✓, FK indexes ✓, one composite
  matching its primary list query ✓ — enforced by PR template checklist.
