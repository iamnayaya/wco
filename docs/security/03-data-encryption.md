# Data Encryption

How WCO protects data with encryption at rest and in transit, and how keys are managed.

## Encryption at rest

Data is encrypted at rest across all stores:

| Store | Mechanism |
|---|---|
| PostgreSQL (RDS) | KMS-managed (aws/kms); AES-256 |
| Elasticache (Redis) | Encryption at rest + in transit (TLS) |
| EBS volumes | KMS-managed AES-256 |
| S3 (uploads, backups) | S3 server-side encryption with KMS; backups KMS-encrypted |
| Application secrets | AWS Secrets Manager (KMS-backed) |

App-level **envelope encryption** for merchant tokens (e.g., provider tokens) via **AWS KMS** — data keys encrypt payloads; KMS wraps data keys.

## Encryption in transit

- **TLS 1.2+** enforced end-to-end, **TLS 1.3** on the edge (CloudFront).
- **HSTS** enabled.
- **Database connections over TLS**; webhooks verified by **HMAC** signature ([Webhooks](../api/webhooks.md)).
- No plaintext HTTP for service-to-service or client-server.

## Key management

- **AWS KMS** is the central key manager (customer-managed where required).
- **Rotation:** keys rotated on schedule (e.g., yearly KMS key rotation / per policy); secrets rotated per the security runbook ([Security runbook](../runbooks/07-security-runbook.md)).
- **Never in code or Git:** keys/secrets live in Secrets Manager, referenced at runtime by the app/operator.
- **Separation:** encryption keys are separated from data; access to KMS is least-privilege + audited.

## What encryption means for you
- Customers/merchants: data is protected at rest on our servers and in transit to your browser/app device.
- Integrators: connect over HTTPS/TLS; the API is TLS-only.
- On export (CSV), data is delivered over a secure authenticated channel — treat exported files as sensitive.

## Key distribution & rotation risk
- Rotation uses a **dual-write** window (new + old key valid) to avoid downtime — see [Security runbook](../runbooks/07-security-runbook.md).
- Never attempt manual DB-level decryption; follow sanctioned tooling.

## Related
- [Compliance runbook](../runbooks/compliance.md#2-encryption-standard)
- [Security overview](./01-security-overview.md)
- API transport security: [`docs/api/security.md`](../api/security.md)
