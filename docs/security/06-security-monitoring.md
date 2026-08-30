# Security Monitoring

How WCO detects suspicious activity and security-relevant anomalies, and how alerts surface.

## What we monitor

| Domain | Signals | Tools |
|---|---|---|
| **Runtime/cloud** | GuardDuty findings, Security Hub controls, CloudTrail, VPC flow anomalies | AWS Security Hub + GuardDuty |
| **Application** | repeated 401/403, permission-change events, API-key misuse, anomalous egress | structured logs, alerts |
| **Auth** | credential-stuffing patterns (bursts of failed logins), token misuse | auth metrics + alerts |
| **Webhooks/PSP** | unexpected payloads, signature failures, refund/fraud anomalies | webhook metrics + anomaly rules |
| **Fraud signals** | unusual order/payment patterns per store | analytics + rules |
| **Infra** | exposed ports, network policy violations, abnormal scaling | K8s audit + network metrics |

## Detection & correlation
- **Central log pipeline** (structured JSON → ELK/Loki) with redaction of restricted data ([Audit trail](../compliance/06-audit-trail.md)).
- **Prometheus metrics** + alert rules for auth/security anomalies (e.g., failed-login rate, WAF block rate).
- **Suspicious patterns** routed to `#security`; severity assessed per [Vulnerability management](./05-vulnerability-management.md).

## Alerting & response

| Severity | Example | Response |
|---|---|---|
| **S1** | confirmed breach, data exfiltration, credential compromise | immediate — [Security incident response](./07-security-incident-response.md) |
| **S2** | strong suspicious activity, high failed-login bursts, WAF block anomaly | investigate; contain |
| **S3/S4** | low-risk anomalies | triage; backlog |

Rules fire into the monitoring stack (Alertmanager → PagerDuty `#oncall` / `#security`) and link to the relevant runbook.

## DDoS / WAF monitoring
- WAF block rate, request patterns, and volumetric anomalies monitored.
- Rate-based rules auto-block abusive traffic; sustained attacks escalate per [Network security](./04-network-security.md).

## Continuous improvement
- **Drills:** security tabletop exercises include monitoring scenarios.
- **Post-incident:** every security event improves detection rules ([Post-mortem playbook](../playbooks/03-post-mortem-playbook.md)).
- Monthly review of security metrics at the [ops/security review](../playbooks/07-compliance-playbook.md#2-continuous-posture).

## Related
- [Security incident response](./07-security-incident-response.md)
- [Monitoring & logging guide](../developer/10-monitoring-logging-guide.md)
- [Security runbook](../runbooks/07-security-runbook.md)
