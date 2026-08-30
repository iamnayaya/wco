# Runbook: Security

Security tooling, secret rotation, and hardening procedures. The strategy and controls are in the [Security documentation](../security/README.md); this is the operational "how to."

> **Responding to a confirmed security incident?** Skip to the [Security incident response runbook](./07-security-runbook.md) equivalent → [Security incident playbook](../playbooks/06-security-incident-playbook.md). Do not debug quietly.

## 1. Secret rotation

Rotation uses a **dual-write** window (new + old valid simultaneously) to avoid outage:

```bash
# 1) Add the NEW secret to AWS Secrets Manager first
aws secretsmanager put-secret-value \
  --secret-id wco/jwt-secret --secret-string "$NEW_VALUE"

# 2) Deploy code/config that accepts BOTH old and new
#    (config supports a list of valid secrets during rotation)

# 3) Roll the app (rollout restarts consumers reading the secret)
kubectl -n wco-prod rollout restart deploy backend-api

# 4) After the dual-write window, remove the old value and rollback config to single secret
```

**Rotation schedule:** JWT/refresh secrets, payment provider keys, DB credentials — rotate per policy (quarterly `npm audit`/credential hygiene; immediate on any suspected leak).

## 2. Dependency & code scanning (embedded in CI)

| Scan | Tool | When |
|---|---|---|
| Secret scanning | gitleaks | every PR |
| SAST | Semgrep + CodeQL | every PR |
| Dependency vulns | npm audit + Snyk | every PR + nightly |
| Container scan | Trivy | image build |
| DAST | OWASP ZAP baseline | qa.yml (per PR/nightly) |

**On a finding:** triage per [Vulnerability management](../security/04-vulnerability-management.md) — critical/current-exploited fixes are S1/S2.

## 3. Key / certificate management

- **KMS** manages encryption keys (customer-managed where required). Rotation yearly, or per policy in [Compliance runbook](./compliance.md).
- **TLS certs** (ACM/Istio): monitored for expiry; renew + reload before < 30 days.

## 4. Hardening checks

- Verify **TLS 1.2+/1.3** on edge; DB over TLS.
- Review **security groups / network policies** (least privilege) — see [Network security](../security/03-data-encryption.md) / [Network security](../security/05-network-security.md) if present.
- Confirm **RLS** is enforced on tenant tables ([Multi-tenancy ADR](../adr/ADR-003-multi-tenancy.md)).
- Run a periodic **IAM/access review** (who has prod access; revoke stale).

## 5. Access & break-glass

- Humans sign in via **SSO + MFA**; no shared static credentials.
- **Break-glass** account only for emergencies, with approval + audit.
- Service-to-service uses **IRSA** (no shared service secrets).
- Every prod deploy writes an **audit record** (actor, sha, timestamp) — [Compliance runbook](./compliance.md).

## 6. Monitoring & alerting on security

- Security Hub / GuardDuty findings → routed to `#security`.
- Watch: repeated 401/429 anomalies, credential misuse, unusual data egress, permission changes.
- On an alerted anomaly → investigate; if confirmed → [Security incident playbook](../playbooks/06-security-incident-playbook.md).

## 7. Reporting & escalation

- Escalate security concerns to the security lead / IC immediately — never "wait and see".
- Coordinate disclosure follows [`SECURITY.md`](../../SECURITY.md).
- Confirm an incident → open the security incident playbook + `#incidents`.
