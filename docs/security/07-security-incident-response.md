# Security Incident Response

How WCO responds to security incidents. The execution steps are in the [Security runbook](../runbooks/07-security-runbook.md); the decision framework and restricted-communication handling are in the [Security incident playbook](../playbooks/06-security-incident-playbook.md).

## When to activate
Activate security incident response for: confirmed or strongly suspected unauthorized access, data exposure/breach, credential compromise, injection/exploitation, malware, payment-data concerns, or fraud linked to WCO accounts.

> **Golden rule:** if you suspect a security incident, contact security immediately — never "wait and see," and never debug in public channels.

## Response phases

1. **Confirm & assess** — security IC takes command; confirm severity with blast radius + data sensitivity.
2. **Contain** — isolate systems, rotate secrets, revoke/suspend compromised credentials, block abusive traffic. Preserve evidence before cleanup.
3. **Eradicate** — remove malicious artifacts; patch the vulnerability as S1; restore from known-good backups if integrity is in question.
4. **Recover & verify** — re-enable services gradually; confirm no re-infection.
5. **Learn** — restricted post-mortem; update detection rules + runbooks.

## Severity

| Severity | Definition | Example |
|---|---|---|
| S1 | confirmed breach / data exposure / credential compromise | immediate full response |
| S2 | strong suspicion, anomalous malicious activity | investigate + contain |
| S3/S4 | low-risk anomalies | triage |

## Communication & notification

- **Internal:** restricted (`#security-incident`), brief leadership.
- **Regulatory (GDPR/NDPR/POPIA):** breach notification via [Compliance playbook](../playbooks/07-compliance-playbook.md#5-breach-notification) (e.g., NDPR/NDPA 72h) — driven by Legal/DPO.
- **Customers:** only via approved channels when legally required.
- **Disclosure:** follow [`SECURITY.md`](../../SECURITY.md) coordinated-disclosure posture; don't publish exploit details before a fix + comms plan.

## Escalation

| Trigger | Escalate to |
|---|---|
| Any suspected security event | Security IC immediately |
| Confirmed breach / PII or card exposure | Legal/DPO + leadership + security IC |
| Payment data | PCI-required parties ([Compliance playbook](../playbooks/07-compliance-playbook.md)) |
| Extended/unknown attacker | external IR/forensics + threat intel |

## Evidence & audit
- Preserve logs, snapshots, and timestamps before cleanup.
- Maintain the audit trail ([Audit trail](../compliance/06-audit-trail.md)) and retain evidence per compliance policy.

## Related
- [Security incident playbook](../playbooks/06-security-incident-playbook.md)
- [Security runbook](../runbooks/07-security-runbook.md)
- [Incident management playbook](../playbooks/01-incident-management-playbook.md)
- [Security monitoring](./06-security-monitoring.md)
