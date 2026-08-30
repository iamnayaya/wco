# Audit Trail

What WCO logs, how to access logs, and how the audit trail supports accountability, troubleshooting, and compliance.

## 1. What is logged

WCO logs operational, access, and security-relevant events. Sensitive records (financial, permission changes, security-relevant) are treated as a formal **audit trail**.

| Category | Examples | Tooling |
|---|---|---|
| **Application events** | order created, payment received, refund processed | structured app logs → ELK/Loki |
| **Access / auth events** | login, logout, token refresh, 2FA, permission changes | structured logs + auth service audit |
| **Data subject / admin actions** | data export, profile deletion, API-key creation | audit events |
| **Infrastructure** | deploys (actor, sha, timestamp), scaling, cloud events | deploy records, CloudTrail, K8s audit |
| **Tenant operations** | store API-key usage, webhook subscriptions | app logs scoped by store |

> **Rule:** sensitive/restricted data **never** appears in logs (passwords, tokens, full card data) — Fluent Bit redacts `password`/`Authorization`/`token` keys. See [Compliance runbook](../runbooks/compliance.md#1-data-classification).

## 2. Log retention

| Source | Retention |
|---|---|
| App logs | 30 days (per [Compliance runbook](../runbooks/compliance.md#4-audit-logging--retention)) |
| K8s events/audit | 30–400 days |
| CloudTrail | 90+ days (S3 lifecycle) |
| Deploy audit | 1 year |
| Security Hub / compliance evidence | per compliance policy |

## 3. How to access logs

- **Support/ops** (read access): Kibana / Loki. Search by `requestId`, `storeId`, service, timestamp.
- **Audit/compliance** (restricted): specific dashboards/reports; access is role-limited and itself logged.
- **Merchants**: don't access raw infra logs; they see their store's activity via [Audit/activity views](../user/guides/settings-guide.md) and can request data from support.

Diagnostic query example (Kibana):
```
level: error AND storeId: "str_123" AND ts >= [now-1h]
```

## 4. Integrity & tamper-evidence
- Logs are **append-only** and centrally shipped.
- Immutable/versioned log storage for sensitive classes (S3 object lock / ELK retention) to prevent tampering.
- Access to audit logs is restricted (least privilege) and monitored.

## 5. Using the audit trail
- **Troubleshooting:** correlate a failure via `requestId` ([Diagnosis](../troubleshooting/02-diagnosis.md)).
- **Security:** investigate anomalous access/egress ([Security incident playbook](../playbooks/06-security-incident-playbook.md)).
- **Compliance:** evidence for audits/DSRs ([Compliance playbook](../playbooks/07-compliance-playbook.md)).
- **Forensics:** preservation before cleanup in an incident.

## 6. Related
- [Monitoring & logging guide](../developer/10-monitoring-logging-guide.md)
- [Compliance runbook](../runbooks/compliance.md)
- [Data retention](./05-data-retention.md)
