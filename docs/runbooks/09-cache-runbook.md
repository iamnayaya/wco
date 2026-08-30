# Runbook: Cache

Operating the Redis cache: hit rate, evictions, hot keys, and flushing. Redis also backs sessions and rate limiting, so **flush carefully**.

## Prerequisites
- Redis access (ElastiCache console / `redis-cli` via a bastion or tunnel).
- Understanding of cache layout (`docs/database/redis-elasticsearch.md`).

## 1. Health & capacity

```bash
redis-cli INFO            # sections: memory, stats, keyspace
redis-cli INFO stats      # cache_hits / cache_misses → hit rate
redis-cli INFO memory     # used_memory, maxmemory, evicted_keys
```

**Watch:**
- **Evictions** (`evicted_keys` increasing) → cache under memory pressure → scale cache or reduce TTLs.
- **Hit rate** low → keys expiring too fast or not being read; tune TTLs / keys.
- **Memory** near `maxmemory` → eviction risk → investigate hot keys.

## 2. Find & address hot keys

```bash
redis-cli --hotkeys       # requires maxmemory-policy; shows hot keys
```
- Hot keys (a key hammered from many clients) cause read amplification → cache sharding, or move the hot data to a separate store.

## 3. Flush a specific cache (safe)

```bash
# Delete by pattern — use with extreme care, prefix-scoped
redis-cli --scan --pattern 'wco:analytics:*' | xargs -r redis-cli DEL

# Or delete a known key
redis-cli DEL wco:products:str_123:catalog
```

**Golden rule:** never run a global `FLUSHALL`/`FLUSHDB` on shared Redis — it would evict sessions and rate-limit counters for every tenant. Cache flushes are **prefix-scoped** to a store/feature.

## 4. Flush everything (only when explicitly intended)

If a full flush is truly required (e.g., schema-invalidating cache change), confirm the blast radius with the requester first:

```bash
redis-cli FLUSHALL
```
Expect: all tenants' sessions invalidated (everyone re-logs in — usually undesirable), caches cold (a latency spike while they repopulate). Prefer warm-up and scoped invalidation.

## 5. Rotate Redis credentials / config

- Rotate via Secrets Manager (`wco/redis-password`), dual-write window per [Security runbook](./07-security-runbook.md).
- TLS in transit (`REDIS_TLS=true` in prod).

## 6. Escalation
- Cache outage affecting auth/sessions → many 401s/errors → [Incident response runbook](./03-incident-response-runbook.md).
- Sustained memory pressure → [Scaling runbook](./05-scaling-runbook.md) (cache section) + capacity planning.
- Data in Redis is **ephemeral** by design — never treat Redis as durable; restore patterns → [Backup & recovery runbook](./04-backup-recovery-runbook.md).
