# Disaster Recovery Runbook

RTO/RPO targets: **RTO ≤ 60 min, RPO ≤ 15 min** for a full region loss.

| Scope    | RTO   | RPO   | Primary mechanism |
|----------|-------|-------|-------------------|
| Node/Pod | < 5m  | n/a   | K8s self-heal, HPA, spot interruption handling |
| AZ event | < 15m | ≤ 5m  | Multi-AZ spread, auto-scaling |
| RDS      | ~1m   | ~0    | Multi-AZ synchronous standby |
| Region   | < 60m | ≤ 15m | DR cutover to eu-west-1 |

---

## 1. Verify backups daily

Nightly job:

- RDS: automated snapshots + `pg_dump --format=custom` to S3 (KMS-encrypted).
- ElastiCache: Redis snapshot (AOF/RDB) to S3.
- S3 uploads: versioning + cross-region replication to eu-west-1.

Backups must be *testable*: run a restore drill monthly (see `scripts/dr-drill.sh`).

## 2. AZ / RDS failover (automatic, < 5 min)

No action for RDS — Multi-AZ flips the CNAME. For ElastiCache, Redis
Cluster-mode nodes survive. Verify connectivity after:

```bash
kubectl -n wco-prod get pods -o wide
curl -fsS https://api.wco.africa/health
```

## 3. Region loss — manual DR cutover

1. **Declare** incident; notify on-call via SNS channel.
2. **Promote** secondary eu-west-1 infra:
   - Update Route53 failover record for `api.wco.africa` to point at the
     eu-west-1 ALB (Traffic Policy, 60s TTL).
   - Run `terraform apply -var-file=envs/prod-dr/terraform.tfvars` to stand
     up the DR region if not already warm.
3. **Restore** data plane to DR (point-in-time if primary data unreachable):
   ```bash
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier wco-prod \
     --target-db-instance-identifier wco-prod-dr \
     --use-latest-restorable-time
   ```
4. **Verify** app health, payment/webhook paths, then direct traffic.
5. **Fail back** once primary is healthy (reverse DNS + data replay).

## 4. Data corruption / accidental delete

- PITR restore of RDS to any 5-min window in the retention period (35 days).
- S3 object version rollback for overwritten uploads.
- Re-run pending migrations against the restored DB **before** re-routing users.

## 5. Post-mortem & restore drill

- Every DR event → runbook review, update RTO/RPO table.
- Keep a copy of this runbook + your `bootstrap.sh`/tfvars in a read-only
  bucket so Ops can recover even if the infra repo is compromised.
