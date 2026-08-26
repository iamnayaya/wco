# WCO Redis & Elasticsearch Design

## 1. Redis keyspace (sessions, rate limits, caches)

Logical databases are avoided (cluster-unsafe); separation is by key prefix.
Hash tags `{...}` co-locate tenant keys on the same cluster slot.

### 1.1 Sessions (replaces a `sessions` table by design)

| Key | Type | TTL | Value |
|---|---|---|---|
| `sess:{sessionId}` | HASH | 15m sliding (refreshed on activity, cap 12h) | userId, merchantId, activeStoreId, role, permissions[], device, ip, createdAt |
| `u:{userId}:sessions` | SET of sessionId | follows member TTL | enables "log out everywhere" |
| `bl:{jti}` | STRING "1" | = remaining JWT life | JWT denylist (logout/rotation) |

Access tokens stay stateless (JWT); Redis holds only the revocable surface.
A flushed Redis costs users one re-login — never data.

### 1.2 Rate limiting (sliding window, atomic Lua)

| Key | Type | Window / limit |
|---|---|---|
| `rl:ip:{ip}:{route-class}` | ZSET timestamps | auth 5/min · api 100/min/user · webhook ingest 10k/s burst · public catalog CDN-shielded |
| `rl:user:{userId}:{class}` | ZSET | per-user API quota |
| `rl:store:{storeId}:wa-send` | ZSET | Meta Cloud API throughput guard (80 msg/s) |

Lua script: `ZREMRANGEBYSCORE` prune → `ZCARD` count → `ZADD now` →
`EXPIRE window+grace` → return allowed?. No race conditions, no clock skew
beyond node drift.

### 1.3 Domain caches & coordination

| Key family | Purpose |
|---|---|
| `{merchant}:prod:{id}` · `{store}:cat:list` | cache-aside entities (300s) |
| `{store}:aicfg` | AI configuration snapshot (60s) |
| `aicache:{store}:{sha256(prompt+model)}` | semantic-cache L1 beside Pinecone (24h) |
| `tok:{merchant}:{yyyymmdd}` | daily AI token budget counter (INCR/EXPIRE 48h) |
| `lock:{resource}` | Redlock distributed locks (10s lease) |
| `dedupe:wa:{waMessageId}` | webhook idempotency guard `SET NX EX 86400` — authoritative message dedupe once messages table is partitioned |
| `bull:{queue}:*` | BullMQ job storage |
| `feat:{flag}` | feature flags (30s poll) |
| `metrics:{store}:today` | dashboard rollup cache (60s) |

Eviction: `volatile-lru`, working set ≤60% of memory; sessions/cache/ratelimit
split into separate clusters past 100GB (scalability-plan §2.6). Durability:
AOF everysec; nothing in Redis is unreconstructable except live sessions.

## 2. Elasticsearch indexes

ES is a **derived** store — full reindex from Postgres must always be possible.

### 2.1 `products-{env}`
```json
{
  "settings": {
    "number_of_shards": 3, "number_of_replicas": 1,
    "refresh_interval": "5s",
    "analysis": {
      "analyzer": {
        "wco_text": { "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "wco_edge"] },
        "wco_exact": { "type": "custom",
          "tokenizer": "keyword", "filter": ["lowercase"] }
      },
      "filter": { "wco_edge": { "type": "edge_ngram", "min_gram": 2, "max_gram": 12 } }
    }
  },
  "mappings": {
    "_meta": { "schema_version": 1 },
    "properties": {
      "id":        { "type": "keyword" },
      "storeId":   { "type": "keyword" },
      "name":      { "type": "text", "analyzer": "wco_text",
                     "fields": { "exact": { "type": "keyword", "normalizer": "lc" } } },
      "sku":       { "type": "keyword" },
      "description":{ "type": "text", "index_phrases": true },
      "categoryName":{ "type": "text", "analyzer": "wco_text" },
      "price":     { "type": "scaled_float", "scaling_factor": 100 },
      "currency":  { "type": "keyword" },
      "status":    { "type": "keyword" },
      "attributes":{ "type": "flat_object" },
      "variantSkus":{ "type": "keyword" },
      "inStock":   { "type": "boolean" },
      "popularity":{ "type": "rank_feature" },
      "updatedAt": { "type": "date" }
    }
  }
}
```
Query pattern: `bool.filter [{term storeId}, {term status:ACTIVE}]` +
`bool.should [match name^3, match description, prefix name.exact]` +
function_score(popularity). Tenant filter is non-negotiable and enforced in the
shared search-client wrapper (mirrors RLS philosophy).

### 2.2 `customers-{env}`
Keyword identity (`storeId`,`waPhone`,`id`) · text fields `name` (ngram),
`tags[]`, `segment` keyword · numeric `totalSpent`,`ordersCount` for
sort/filter · `lastOrderAt` date. Powers inbox-side "find customer" with
typo tolerance (`fuzziness: AUTO`) that pg_trgm can't match on 3G-typed names.

### 2.3 `threads-{env}` (conversation search, 90-day hot window)
`conversationId`,`storeId`,`customerId` keywords · `body` text with
`highlight` enabled · `direction`,`sentByBot` keywords · `createdAt` date.
ILM: hot 30d → delete at 90d (PG archive remains source of truth).

### 2.4 Lifecycle & consistency

* **CDC pipeline:** Debezium PG connector → RabbitMQ → indexer workers upsert
  documents within ~2s p95; nightly reconciler diffs counts per store and
  repairs drift.
* **Zero-downtime reindex:** alias `products` → `products-vN`; build vN+1 via
  `_reindex` + live CDC tail, validate doc counts + sampled relevance, flip
  alias atomically. Schema changes bump `_meta.schema_version`.
* **Failure mode:** ES down ⇒ search endpoints fall back to pg_trgm indexes
  (degraded banner), never to unindexed ILIKE scans.
