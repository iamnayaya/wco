# Playbook: Incident Management

How WCO detects, commands, communicates about, and resolves incidents — with the decision framework behind the [Incident response runbook](../runbooks/03-incident-response-runbook.md).

## 1. Severity definitions

| Severity | Definition | 1st response | Fix target |
|---|---|---|---|
| **S1** | Outage, data loss, money loss, security incident | 15 min | 24h hotfix |
| **S2** | Major feature broken; workaround exists | 4h | 72h |
| **S3** | Minor bug; no impact blocker | 24h | next release |
| **S4** | Cosmetic / friction | 72h | backlog |

Severity is **confirmed in triage** (not by the reporter alone) and adjusted when blast radius changes.

## 2. Detection

Incidents originate from:
- Page-worthy alerts (SLO burn > 2x, availability breach, data/money loss).
- Internal reports of user impact.
- Support ticket spikes / Sentry error spikes.
- Security events.

**Rule: if users are affected, declare immediately.** Err on the side of declaring S2 and reassessing, rather than waiting and finding it was worse.

## 3. Roles during an incident

| Role | Responsibility |
|---|---|
| **Incident Commander (IC)** | Owns the incident; runs the bridge; delegates; communicates status. One IC, no fighting over the mic. |
| **Scribe** | Tracks timeline + actions in the incident doc for the post-mortem. |
| **Comms lead** | Single voice for internal `#incidents` + external status page. |
| **Operations / on-call** | Executes mitigation runbooks. |
| **Eng leads** | Root-cause + fix tactics; escalate to tech leads. |
| **Security IC** | Present + in command when a **security** incident is confirmed (see playbook 06). |

At minimum on a bridge: IC + scribe + comms + affected squad(s) + ops.

## 4. Command flow

1. **Declare** → create incident issue + bridge + assign roles.
2. **Communicate** → status page + `#incidents` immediately.
3. **Mitigate** → stabilize first (rollback / flag / scale / failover), then diagnose.
4. **Confirm** → verify recovery, monitor a full window.
5. **Close** → update doc with timeline + root cause; schedule post-mortem (S1/S2).

## 5. Communication template

> **Status:** `DEGRADED` | `MAJOR OUTAGE` | `MONITORING` | `RESOLVED`
> **Impact:** [services, regions, % users]
> **Fix:** [what's being done]
> **ETA:** [best estimate or "assessing"]

Keep the status page updated even with "assessing" — silence is worse than an imperfect update.

## 6. Judgment calls (the IC's playbook)
- **Speed vs. root cause:** mitigate first; don't block mitigation on proof of root cause.
- **Rollback bias:** when in doubt after a deploy, roll back. [Deployment runbook](../runbooks/01-deployment-runbook.md).
- **Data risk:** never `FLUSHALL`, blind-restore, or purge without a decision — see [Cache](../runbooks/09-cache-runbook.md) / [Queue](../runbooks/10-queue-runbook.md) / [Backup](../runbooks/04-backup-recovery-runbook.md).
- **Escalate up fast:** S1 that drags → get leadership + broader team earlier, not later.

## 7. Handoff & learning
- Hand off cleanly between shifts (seen state, in-flight actions, open questions) — see [On-call playbook](./02-on-call-playbook.md).
- Every S1/S2 gets a [post-mortem](./03-post-mortem-playbook.md) within 5 business days.
- Update runbooks/playbooks when the playbook missed a step.
