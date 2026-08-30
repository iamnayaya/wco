# Security Documentation

WCO's security architecture, controls, and practices for security teams, auditors, and customers.

> **Reporting a vulnerability:** email **security@wco.com** (monitored 24/7) — do **not** open a public issue. Policy & safe harbor: [`SECURITY.md`](../../SECURITY.md).

## Document map

| Document | Contents |
|---|---|
| [Security overview](./01-security-overview.md) | Architecture, controls, security model |
| [Authentication & authorization](./02-authentication-authorization.md) | AuthN/AuthZ, RBAC, tenancy |
| [Data encryption](./03-data-encryption.md) | Encryption at rest & in transit, key management |
| [Network security](./04-network-security.md) | WAF, firewalls, DDoS, network policies |
| [Vulnerability management](./05-vulnerability-management.md) | SAST/DAST, dependency, patch process |
| [Security monitoring](./06-security-monitoring.md) | Logs, alerts, anomaly detection |
| [Security incident response](./07-security-incident-response.md) | Response process & escalation |
| [Certifications](./08-certifications.md) | Standards & attestation |
| [Security policy (summary)](./SECURITY_POLICY.md) | Reporting & posture summary |

## Security model at a glance

| Layer | Control |
|---|---|
| **AuthN** | Short-lived JWTs (15m) + rotating single-use refresh tokens (reuse = family revocation) |
| **AuthZ** | Permission strings per route; OWNER/MANAGER/AGENT roles |
| **Tenancy** | Store-scoped queries via TenantContext guard; Postgres RLS as backstop |
| **Transport** | TLS everywhere; HSTS; webhook HMAC verification fails closed |
| **Secrets** | AWS Secrets Manager → External Secrets Operator; never in Git; rotation policy |
| **Containers** | Non-root UID 10001, read-only rootfs, caps dropped, seccomp |
| **Network** | Default-deny NetworkPolicies; egress allowlists |
| **Rate limits** | Global 100/min; stricter on auth/payments |
| **SDLC** | CodeQL SAST, gitleaks, Trivy, Dependabot, mandatory 2-reviewer on sensitive paths |

## Deep dive
- Architecture-level security design: [`docs/architecture/security-plan.md`](../architecture/security-plan.md)
- API security controls: [`docs/api/security.md`](../api/security.md)
- Compliance (GDPR/NDPR/PCI): [`docs/compliance/`](../compliance/README.md)
- Operational security runbooks: [`docs/runbooks/07-security-runbook.md`](../runbooks/07-security-runbook.md) and [`docs/runbooks/security.md`](../runbooks/security.md)
