# Runbook: Scaling

Procedures for scaling WCO compute, database, cache, and queues to handle growth or load spikes. Capacity *planning thinking* and forecasting are in the [Capacity planning playbook](../playbooks/04-capacity-planning-playbook.md); this is the hands-on scaling.

## Principles
- WCO is **stateless and horizontally scalable** — prefer adding replicas over bigger machines, except where data stores require vertical scaling first.
- **Autoscaling is the default** (HPA / KEDA). This runbook covers manual override and vertical (DB) scaling.

## Prerequisites
- `kubectl` access to the cluster; AWS console/CLI for RDS/ElastiCache.
- Knowledge of current capacity: pods, replica counts, DB instance class, cache nodes, queue workers.

## 1. Scale application pods horizontally

```bash
# Scale a deployment manually (temporary)
kubectl -n wco-prod scale deployment backend-api --replicas=12

# Persistent: edit the HPA min/max
kubectl -n wco-prod edit hpa backend-api
#   minReplicas: 6
#   maxReplicas: 24
#   targetCPUUtilizationPercentage: 70
```

**Verify:** effective replica change, no rollout crash-loops, latency improves.

## 2. Scale database (Postgres RDS)

> Database scaling is **vertical first** (instance class), then **read replicas** for read-heavy workloads, then **sharding** per the [partitioning/sharding plan](../database/partitioning-sharding.md).

### a) Vertical (instance class)
```bash
aws rds modify-db-instance \
  --db-instance-identifier wco-prod \
  --db-instance-class db.r6g.xlarge \
  --apply-immediately
```
Plan a **maintenance window** for non-immediate changes. Monitor for a brief connection hold during modifier.

### b) Add a read replica
```bash
aws rds create-db-instance-read-replica \
  --db-instance-identifier wco-prod-rr1 \
  --source-db-instance-identifier wco-prod
```
Point read-only workloads (analytics, reporting) at the replica. Keep app writes on primary.

### c) Scaling triggers & limits
- Watch **CPU, connections, IOPS, storage** — not just CPU.
- Scaling DB is slower than scaling app replicas; plan ahead (forecast) → [Capacity planning playbook](../playbooks/04-capacity-planning-playbook.md).

## 3. Scale cache (Redis ElastiCache)

```bash
# Add a node / change node type
aws elasticache modify-replication-group \
  --replication-group-id wco-cache \
  --cache-node-type cache.r6g.large \
  --apply-immediately
```
Watch: memory used, evictions, hit rate. **Evictions ↑** or **high memory** → scale cache or shrink key TTLs ([Cache runbook](./09-cache-runbook.md)).

## 4. Scale queues (RabbitMQ)

- Scale **consumers/workers** (app replicas) to drain backlogs — see [Queue runbook](./10-queue-runbook.md).
- If RabbitMQ node is saturated: add nodes to the cluster (brave only with a plan; prefer draining first).

## 5. Autoscaling health check

| Signal | Action |
|---|---|
| HPA scaling but latency still high | App saturates DB/cache, not CPU → scale DB/cache, not pods |
| Scaling down too slow | Tune HPA stabilization windows |
| Crash-loops after scale | Rollback; augment resources, not just replicas |

## 6. Rollback
- Reverse any manual replica change after the spike passes.
- If a scale action caused problems, revert the HPA/replica settings to previous values and watch.

## Escalation
- Capacity ceiling reached despite scaling → [Capacity planning playbook](../playbooks/04-capacity-planning-playbook.md) + raise to ops lead.
- Users impacted → [Incident response runbook](./03-incident-response-runbook.md).
