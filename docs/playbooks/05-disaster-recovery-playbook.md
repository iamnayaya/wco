# Playbook: Disaster Recovery

The decision framework for recovering from disasters (region loss, data corruption, prolonged outage). The procedural steps with exact commands are in the [DR runbook](../runbooks/dr.md) and [Backup & recovery runbook](../runbooks/04-backup-recovery-runbook.md).

## Objectives (RTO/RPO)

| Scope | RTO | RPO | Mechanism |
|---|---|---|---|
| Node/Pod | < 5m | n/a | K8s self-heal + HPA |
| AZ event | < 15m | ≤ 5m | Multi-AZ, auto-scaling |
| RDS | ~1m | ~0 | Multi-AZ synchronous standby |
| **Region loss** | **< 60m** | **≤ 15m** | DR cutover to eu-west-1 |

> The authoritative numbers live in [`docs/runbooks/dr.md`](../runbooks/dr.md). Keep a read-only copy of the DR runbook + `bootstrap.sh`/tfvars in a DR-safe bucket so Ops can recover even if the infra repo is compromised.

## Declare & decide

1. **When does this playbook apply?**
   - Full region loss / prolonged primary outage.
   - Data corruption or accidental deletion requiring restore.
   - Any event where normal mitigation (rollback/scale/failover) isn't enough.

2. **Decide: recover in-place vs. DR cutover.** Ask:
   - Is the primary region expected to recover within RTO? If no → cutover.
   - Is data damaged vs. unavailable? Corrupt data changes the restore strategy.

3. **Assess blast radius** — services, regions, users, and whether data is at risk.

## Execute

Follow in order:

1. **Declare + notify** on-call (SNS/incident) — [Incident management playbook](./01-incident-management-playbook.md).
2. **Protect data first** — do not overwrite; snapshot/point-in-time-safe before destructive actions ([Backup runbook](../runbooks/04-backup-recovery-runbook.md)).
3. **DR cutover (region loss)** — per [DR runbook](../runbooks/dr.md): promote DR region, restore data plane, verify health + payments/webhooks, then route traffic.
4. **Restore data (corruption/delete)** — PITR within the retention window; re-run pending migrations on the restored DB **before** re-routing users.
5. **Verify** comprehensively: health, key transactions, payment/webhook paths, sync from primary when fail-back.

## Judgments (the DRIC's calls)

- **When to declare failure** of primary vs. waiting — decide early, reassess often.
- **RPO vs. data loss:** if you can't meet RPO, be explicit about how much data may be lost and get a decision from the data owner before cutting over.
- **Don't restore over new data:** if writes occurred post-corruption, restoring an old PITR **loses** the new data — align on the least-bad path.
- **Fail-back plan:** restore primary health, replay/reconcile data, then reverse DNS. Never fail back half-done.

## Roles
- **DR Incident Commander** — owns cutover decision + timeline.
- **Data owner** — approves RPO/data-loss trades.
- **Ops/SRE** — executes per runbooks.
- **Comms** — status page + internal.

## Drills & rehearsal
- **Monthly restore drill** (`scripts/dr-drill.sh`) — restore latest backup to a scratch instance, validate, discard.
- **Quarterly tabletop** — walk a scenario (region loss) with the team to test decisions.
- Every drill/event → **review + update** RTO/RPO table and this playbook.

## Close & learn
- Post-mortem per [Post-mortem playbook](./03-post-mortem-playbook.md) — S1 mandatory.
- Update the DR runbook with any step that failed or was missing.
