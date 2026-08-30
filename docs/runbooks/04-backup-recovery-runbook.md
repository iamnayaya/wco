# Runbook: Backup & Recovery

Procedures for backing up and restoring WCO's data, and running disaster-recovery drills. Business continuity *thinking* (RTO/RPO, failover strategy) is in the [Disaster recovery playbook](../playbooks/05-disaster-recovery-playbook.md) and [DR runbook](./dr.md); this is the hands-on backup/restore.

## Backup architecture (summary)

| Data | Backup method | Frequency | RPO target |
|---|---|---|---|
| PostgreSQL (RDS) | Automated snapshots + PITR (WAL) | continuous PITR, daily snapshot | ≤ 5 min |
| Redis | Config/keys; ephemeral by design (cache + sessions) | n/a (rebuild) | n/a |
| S3 object storage | Versioning + replication | continuous | < 1 minute |
| Elasticsearch | Snapshot repository | daily | ≤ 1 h |
| Config/secrets | IaC + Secrets Manager (recreate from code) | on change | rebuild from repo |

> The authoritative DR design (RTO/RPO numbers, region failover) is in [`docs/runbooks/dr.md`](./dr.md) and [`docs/database/backup-recovery.md`](../database/backup-recovery.md).

## Prerequisites
- IAM / access to run backups and restores (break-glass, audited).
- Ernst of RDS snapshot + S3 bucket (backup repository).

## 1. Take a manual database backup (point-in-time)

```bash
# RDS snapshot (one-off)
aws rds create-db-snapshot \
  --db-instance-identifier wco-prod \
  --db-snapshot-identifier wco-prod-manual-$(date +%Y%m%d-%H%M)

# Or export via pg_dump for portability / offline
pg_dump "postgresql://..." -Fc -f wco_prod_$(date +%Y%m%d).dump
```

**Verify** the snapshot is `available` before relying on it.

## 2. Restore a database

> Restores are **to a new instance/cluster** first — never blind-overwrite prod.

```bash
# Restore snapshot to a new RDS instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier wco-prod-rr-<ts> \
  --db-snapshot-identifier wco-prod-manual-...

# Point-in-time recovery to a specific time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier wco-prod \
  --target-db-instance-identifier wco-prod-pitr-<ts> \
  --restore-time <UTC-timestamp>
```

1. Wait until the restored instance is `available`.
2. Validate data (row counts, newest order timestamps, schema version).
3. `pg_restore` if using a dump, or switch connection URI to the restored instance (see [Database runbook](./08-database-runbook.md) for connection swap + app restart).
4. Confirm app health + key reads.

## 3. Restore S3 objects

```bash
# List versions and restore a deleted/overwritten object
aws s3api list-object-versions --bucket wco-prod-assets --prefix orders/2026/08/29/
aws s3 cp "s3://wco-prod-assets/orders/2026/08/29/receipt.pdf" \
  --version-id <vid> ./receipt.pdf
```

## 4. Restore Elasticsearch (if needed)

```bash
# From the snapshot repository
curl -X POST "https://es.wco/snapshot_repo/wco-daily/_restore" \
  -H "Content-Type: application/json" \
  -d '{ "indices": "wco-logs-*", "rename_pattern": "(.+)", "rename_replacement": "restored_$1" }'
```

## 5. Scheduled backups & monitoring

- Backups run automatically per the retention policy (`docs/database/backup-recovery.md`).
- **Monitor** backup health: alert if a scheduled snapshot/RPO is missed.
- **Drill:** run a restore drill quarterly (create new instance, restore latest snapshot, validate) and log results → see [Post-mortem playbook](../playbooks/03-post-mortem-playbook.md) pattern for capture.

## Failure / errors

| Symptom | Fix |
|---|---|
| Snapshot stuck `creating` | Check IAM/permissions; contact AWS support |
| Restore instance unhealthy | Wait for finalization; validate connection string after promote |
| PITR time out of range | Only within backup retention window; use nearest snapshot |
| Secrets missing after restore | Restore from Secrets Manager (they're not in the DB) |

## Escalation
- Data loss or restore doubt → declare incident; **do not** overwrite prod data without a decision from the DR/data owner.
- See [Incident response runbook](./03-incident-response-runbook.md) and [DR runbook](./dr.md).
