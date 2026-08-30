# Playbook: Capacity Planning

Plan and forecast WCO's infrastructure capacity so we scale **before** load hurts users, not after. The hands-on scaling steps are in the [Scaling runbook](../runbooks/05-scaling-runbook.md).

## Goals
- Keep service within SLO during growth, launches, and seasonal spikes.
- Predict when resources hit limits (cost + reliability).
- Avoid both under-provisioning (SLO breaches) and runaway over-provisioning (cost).

## Inputs / data sources
- **Traffic forecast:** growth curve, new-market launches, seasonal patterns (e.g., festive seasons), marketing campaigns.
- **Current utilization:** per-service CPU/memory, DB connections/IOPS/storage, cache hit-rate/evictions, queue throughput.
- **SLO headroom:** how much error budget remains.
- **Historical:** holiday spikes, promo traffic, past peak:normal ratios.

## The planning cycle (quarterly + event-driven)

1. **Forecast demand** for the next quarter across services (revenue/user → requests → DB/queue/cache).
2. **Model the ceiling:** for each bottleneck (app replicas, DB instance class, cache nodes, workers), compute the **breakpoint** where capacity is exceeded.
3. **Compare with the budget** → decide scale-up plan (add now vs. monitor).
4. **Prioritize** the largest/riskiest constraints first (usually the DB or queues, which scale slower).
5. **Implement** per the [Scaling runbook](../runbooks/05-scaling-runbook.md) — prefer autoscaling with sensible min/max.
6. **Load-test** the new shape to validate ([k6](../qa/README.md)) before big events.
7. **Review** cost impact with the [Cost runbook](../runbooks/cost.md) — scale with a cost/benefit view.

## Key metrics to watch for planning

| Constraint | Metric | Warning |
|---|---|---|
| App replicas | CPU/mem utilization, latency | sustained >70% or queuing |
| Database (primary) | connections, IOPS, storage, write latency | >80% storage; high lock waits |
| Read replicas | replication lag, CPU | lag growing / sustained high |
| Cache | memory used, evictions, hit rate | evictions > 0 sustained; hit rate dropping |
| Queues | depth, consumer lag | depth trending up over time |
| Search (ES) | shard size, heap | disk near low-watermark |

## Right-sizing & cost guardrails
- **Match scale to demand** — scale down off-peak (HPA min) to save cost; keep headroom predictable.
- **Autoscale thresholds** tuned per service, not one-size-fits-all.
- **Revisit** instance classes/nodes quarterly; don't auto-grow forever (waste).
- Track the **cost per request / per active merchant** as a health metric.

## Event planning (launches, promos, festive peak)
1. Agree projected peak multiple (e.g., 3–5× current peak) with Growth.
2. Pre-scal (app replicas, DB, cache, workers) **ahead** of the event.
3. **Load-test** (`k6`) at the target multiple on staging.
4. Day-of: on-call watch; autoscaling as safety net.
5. After: scale back + capture lessons.

## Output
- A short **capacity plan** (quarterly): forecast table + bottleneck list + actions with owners/dates.
- Documented in the ops channel / sprint with tracked action items.

## Escalation
- Approaching a ceiling faster than forecast → raise to ops lead; prioritize per [Scaling runbook](../runbooks/05-scaling-runbook.md).
- SLO breach risk → treat as incident per [Incident management playbook](./01-incident-management-playbook.md).
