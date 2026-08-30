# Playbook: On-Call

Duties and expectations for being on-call for WCO. On-call rotates across platform/SRE + squads; the schedule lives in Notion.

## Before your shift

1. **Confirm your on-call channel & escalation:** you're reachable on PagerDuty + the designated Slack channel (`#oncall`).
2. **Environment access:** `kubectl` (read + break-glass), Grafana, Kibana, Sentry, RabbitMQ UI, AWS console (break-glass, audited).
3. **Read the runbooks** you don't know: [Runbooks index](../runbooks/README.md) + [Monitoring runbook](../runbooks/02-monitoring-runbook.md).
4. **Know your backup** — who's secondary; overlap before/after handoff.

## Your responsibilities

- **Be reachable** and acknowledge pages promptly (SLA: S1 15 min first response).
- **Answer pages** from monitoring; triage severity per [Incident management playbook](./01-incident-management-playbook.md).
- **Stabilize first:** follow runbooks; declare an incident when users are affected (don't debug quietly).
- **Keep the incident doc + status page current** (even "assessing").
- **Own the alert to resolution** or a clean handoff — you're accountable for the shift's alerts.
- **Log everything:** timeline entries (what/when/result) feed the post-mortem.

## What to do on a page

1. **Acknowledge** immediately.
2. **Read the alert:** what service, what signal, which runbook does the annotation link to?
3. **Assess severity** → is this page-worthy per SLO/severity? Users affected?
4. **If affected → declare incident** (bridge + roles + comms) per [Incident management playbook](./01-incident-management-playbook.md).
5. **Mitigate** via the linked runbook (rollback/flag/scale/failover).
6. **Document + verify** recovery, then monitor a window.

## When to escalate

| Trigger | Escalate to |
|---|---|
| S1 confirmed | IC + affected squad leads + ops lead immediately |
| Root cause outside your expertise | Squad tech lead / on-call SME dial-in |
| Data loss / security suspicion | Data owner / security IC (playbook 06) |
| Extended (> 30 min S1) | Top-level IC + leadership escalation |

## Handoff process

Use a written handoff (Slack thread / shift doc):

- **Incidents open:** severity, current mitigation, next steps, who's engaged.
- **Open alerts/tickets:** state + needed follow-up.
- **Ongoing changes:** anything in flight that could page.
- **Environment state:** anything unusual (rollout mid-flight, degraded provider).
- **To-dos:** items to continue next shift.

Confirm the incoming on-call has received and understands the handoff before you're done.

## Hygiene & wellness

- Staggered on-call with defined hours; escalate for rest (no heroics).
- Post-incident, ensure you close the loop and hand off before ending your shift.
- Bring gaps you found to the ops review / a runbook update — that's how the process gets better.

## Recognition
On-call is a valued rotation; incidents handled well are recognized in ops review and post-mortem callouts.
