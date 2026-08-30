# Compliance Runbook

WCO processes PII (customer business/owner data, payment links). We map
controls to **NIST 800-53** and **ISO/IEC 27001:2022**, with Security Hub
providing continuous evidence.

## 1. Data classification

| Class   | Examples                                   | Controls required                     |
|---------|--------------------------------------------|---------------------------------------|
| Public  | marketing copy, static assets             | baseline                              |
| Internal| deploy records, dashboards                | RBAC, least-privilege                 |
| Sensitive| business profile, orders                  | encryption, RBAC, audit              |
| Restricted| payment link tokens, OAuth creds, secrets| KMS, SecretsManager, no logs of raw |

**Rule:** restricted data never appears in logs, image layers, or commit
history. Fluent Bit redacts `password`/`Authorization`/`token` keys.

## 2. Encryption standard

- **At rest:** KMS (aws:kms) on RDS/S3/EBS/ElastiCache; AES-256 if keyless.
- **In transit:** TLS 1.2+ enforced, TLS 1.3 on edge; DB connections over TLS.
- **Keys:** customer-managed KMS with rotation (yearly) where required.

## 3. Identity & access (I&A)

- SSO with MFA for all humans; break-glass account only on approval.
- Service-to-service uses IRSA roles; no shared secrets between services.
- Every prod deploy writes an audit record (actor, sha, timestamp).

## 4. Audit logging & retention

| Source           | Retention | Tooling                     |
|------------------|-----------|-----------------------------|
| App logs         | 30 days   | Loki                        |
| K8s events/audit | 30–400 days | EKS control plane logging |
| CloudTrail       | 90 days+   | S3 (lifecycle) + Security Hub |
| Deploy audit     | 1 year     | GitHub + deploy-record      |

## 5. Standard controls mapping

| Control | Requirement | WCO implementation |
|---------|-------------|--------------------|
| AU-2/6  | audit events generated & reviewed | CloudTrail + GuardDuty + app audit |
| IA-5    | authenticator mgmt | SSO/MFA, IRSA, rotation |
| SC-7    | boundary protection | VPC, NetworkPolicies, WAF |
| SC-28   | PII confidentiality | KMS at rest, TLS in transit |
| SI-7    | software/firmware integrity | cosign-signed images + SBOM |
| CP-9    | system backup | nightly snapshots + PITR |
| RA-5    | vulnerability scanning | Inspector2 on ECR/EC2 |

## 6. Quarterly compliance review

1. Export Security Hub compliance status.
2. Verify no `restricted` data in logs (Loki query across 30 days).
3. Rotate break-glass credentials; re-verify IRSA role bounds.
4. Re-run `scripts/verify-release-signatures.sh` and SBOM scans.
5. Update this document + the ADRs with any drift.
