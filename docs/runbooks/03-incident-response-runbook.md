# Runbook: Incident Response

Respond to a **live incident** affecting users. This is the execution arm; for the decision framework (severities, bridge, communication template) see the [Incident management playbook](../playbooks/01-incident-management-playbook.md).

## 1. Declare / detect

An incident starts when one of these fires:
- A page-worthy alert (SLO burn > 2x, availability breach, data/money loss).
- An internal report of user impact.
- A spike in support tickets or Sentry counts.
- A security event (→ also open [Security runbook](./07-security-runbook.md)).

If **users are affected**, declare an incident immediately — don't wait for confirmation.

## 2. Triage (first 5 minutes)

- **Identify the severity** using the SLA table:

| Severity | Definition | 1st response | Fix target |
|---|---|---|---|
| S1 | Outage/data loss/money loss/security | 15 min | 24h hotfix |
| S2 | Major feature broken, workaround exists | 4h | 72h |
| S3 | Minor bug, no blocker | 24h | next release |
| S4 | Cosmetic | 72h | backlog |

- **Open a bridge** (Zoom/Meet). Add: on-call, affected squad leads, ops, comms.
- **Create the incident issue** (template) with: title, severity, services, start time, lead.
- **Estimate blast radius:** which services/users/regions are affected?

## 3. Mitigate (stabilize first, diagnose second)

- **Goal:** restore service / contain damage. Don't root-cause before stabilizing.
- Common mitigations:
  - **Rollback** the last deploy → [Deployment runbook](./01-deployment-runbook.md).
  - **Flip a feature flag** off (`@wco/config/flags`).
  - **Scale up / shed load** → [Scaling runbook](./05-scaling-runbook.md).
  - **Clear a poisoned queue** → [Queue runbook](./10-queue-runbook.md).
  - **Fail over** a dependency → [DR runbook](./dr.md) / [Backup & recovery](./04-backup-recovery-runbook.md).
- Document every action + timestamp in the incident issue.

## 4. Communicate

- Post to `#incidents` + the status page if public impact.
- Update the [status page](https://status.wco.com) with severity + ETA.
- Assign a **single communicator** so messaging is consistent.
- Follow the [communication template](../playbooks/01-incident-management-playbook.md#communication).

## 5. Diagnose & confirm resolution

- Use [Monitoring runbook](./02-monitoring-runbook.md) to find the root cause.
- Confirm mitigation worked: errors down, latency normal, queues draining.
- Keep monitoring for a full window post-resolution before closing.

## 6. Post-incident

- Close the bridge and update the issue with the timeline + root cause.
- Complete a **post-mortem** within 5 business days (S1/S2 required) → [Post-mortem playbook](../playbooks/03-post-mortem-playbook.md).
- File follow-up tasks (action items with owners).
- If a runbook missed a step, **update the runbook now.**

## Escalation

| Level | When | Who |
|---|---|---|
| IC (Incident Commander) | declared incident | on-call / designated IC |
| Squad tech lead | unblocking or deep diagnosis | affected squads |
| Ops lead / VP Eng | S1, extended outage, cross-team | escalate at thresholds |
| C-level | major customer/compliance/security impact | per severity matrix |
| Security IC | confirmed security incident | see [Security runbook](./07-security-runbook.md) |
