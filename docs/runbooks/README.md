# Runbooks — Operations

Runbooks are the step-by-step operational procedures the operations/SRE team executes. They're the "known, repeatable" counterpart to the more decision-oriented [Playbooks](../playbooks/README.md).

> **Style:** each runbook is actionable and prescriptive — exact commands, expected outputs, rollback steps, and who to contact. If a runbook is missing a step, add it; runbooks are owned like code.

## Runbook index

| # | Runbook | When to use |
|---|---|---|
| 01 | [Deployment](./01-deployment-runbook.md) | Deploy to dev/staging/prod; rollback |
| 02 | [Monitoring](./02-monitoring-runbook.md) | Investigate metrics/logs/traces; tune alerts |
| 03 | [Incident response](./03-incident-response-runbook.md) | Respond to a live incident (bridge, severity, comms) |
| 04 | [Backup & recovery](./04-backup-recovery-runbook.md) | Backup, restore, DR drills |
| 05 | [Scaling](./05-scaling-runbook.md) | Scale compute, DB, cache, queues |
| 06 | [Maintenance](./06-maintenance-runbook.md) | Planned downtime, upgrades, version bumps |
| 07 | [Security](./07-security-runbook.md) | Security tooling, secret rotation, hardening |
| 08 | [Database](./08-database-runbook.md) | Manage Postgres, migrations, performance |
| 09 | [Cache](./09-cache-runbook.md) | Manage Redis, flush caches, hot keys |
| 10 | [Queue](./10-queue-runbook.md) | Manage RabbitMQ, backlogs, dead letters |
| — | [Compliance](./compliance.md) *(existing)* | Compliance controls, audits |
| — | [Cost](./cost.md) *(existing)* | Cost optimization |
| — | [DR](./dr.md) *(existing)* | Disaster recovery & failover |
| — | [Troubleshooting](./troubleshooting.md) *(existing)* | Ops troubleshooting |

## Reading the index

- **Start here** for any runbook → follow the numbered steps top to bottom.
- Each runbook lists **Prerequisites**, **Steps**, **Verify**, **Rollback**, and **Escalation**.
- Alerts in Prometheus carry annotations linking to the relevant runbook, so on-call knows exactly what to open.

## Cross-references

- Incident *decision-making* → [Incident management playbook](../playbooks/01-incident-management-playbook.md)
- On-call *duties* → [On-call playbook](../playbooks/02-on-call-playbook.md)
- Business continuity thinking → [Disaster recovery playbook](../playbooks/05-disaster-recovery-playbook.md)
- Environments & data policy → [Deployment guide](../developer/09-deployment-guide.md)
