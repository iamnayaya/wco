# Runbook: Maintenance

Planned maintenance, version upgrades, and controlled downtime. The goal: zero or minimal user impact, with clear communication.

## Principles
- **Prefer zero-downtime** rolling operations over maintenance windows (rolling updates, canary, blue/green).
- When a maintenance **window is required** (e.g., certain DB upgrades), schedule it at off-peak, announce ahead, and keep it short.
- Never perform maintenance during an active incident.

## Prerequisites
- A **change ticket**/plan with: what, why, impact, rollback, owner, ETA.
- Communication drafted (status page + `#announcements`).
- Backups verified (see [Backup & recovery runbook](./04-backup-recovery-runbook.md)).

## Common maintenance procedures

### 1. Apply minor application/image versions
Rolling via ArgoCD / rollout — no window:
```bash
argocd app sync wco-prod
# watch rollout; auto health-gated
```

### 2. Upgrade Node / runtime base image
1. Bump version in Dockerfile(s) in a feature branch.
2. CI builds + runs tests.
3. Rolling deploy via ArgoCD; verify per [Deployment runbook](./01-deployment-runbook.md).

### 3. RDS maintenance (version/patch)
```bash
# Schedule a maintenance window (off-peak)
aws rds modify-db-instance \
  --db-instance-identifier wco-prod \
  --preferred-maintenance-window "sun:04:00-sun:05:00"
```
- Multi-AZ reduces downtime; single-AZ maintenance causes a brief outage → announce.
- Test version upgrades on staging first.

### 4. Certificate rotation
- Managed via ACM/Istio — verify certs aren't expiring (alerting on expiry).
- Manual: renew + reload on edge (istio/Gateway).

### 5. Secrets rotation
Follow [Security runbook](./07-security-runbook.md) secrets section. Rotate credentials with a **dual-write** (new + old valid) window to avoid outages.

## During the maintenance
- Monitor the golden signals for the service being touched → [Monitoring runbook](./02-monitoring-runbook.md).
- Confirm health checks pass at each step.
- Communicate progress on the status page if announced.

## Verify & close
- Post-maintenance health check: `curl /health`, key reads, transaction test.
- Update the change ticket with outcome.
- If user impact exceeded plan, file a post-incident note.

## Rollback
- App version: re-sync previous tag / `helm rollback` ([Deployment runbook](./01-deployment-runbook.md)).
- DB upgrade: only proceed when a confirmed restore point exists; on failure, restore per [Backup & recovery](./04-backup-recovery-runbook.md) — but **do not** blindly restore over data written post-upgrade.

## Escalation
- Unexpected outage during maintenance → [Incident response runbook](./03-incident-response-runbook.md).
- Data risk → pause maintenance, involve data owner per [DR runbook](./dr.md).
