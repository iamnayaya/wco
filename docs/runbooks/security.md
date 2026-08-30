# Security Runbook

Everything below is enforced by code, not by process. If a control is not in
`infra/`, it does not exist.

## 1. Guardrails in place

| Layer        | Control                                                     |
|--------------|-------------------------------------------------------------|
| Identity     | IRSA + OIDC, least-privilege, no static cloud keys on cluster|
| Secrets      | AWS Secrets Manager via ESO; never committed (gitleaks)     |
| Pod security | `restricted` PSS at admission (Kyverno), drop ALL caps, RO fs|
| Network      | private subnets, ingress-only ALB, strict NetworkPolicies   |
| App          | TLS1.3, WAFv2 (SQLi/XSS/Bot), SAML/OIDC auth, SAST+CodeQL   |
| Data         | KMS at rest (RDS/S3/EBS), TLS in transit, secrets redacted  |
| Detect       | GuardDuty, Inspector2 (ECR/EC2), Security Hub, PII controls|

## 2. Responding to an alert

**Page alerts (5xx error rate > 5%, GuardDuty finding):**

1. Acknowledge within 5 min; assign on-call.
2. **Contain:** for a suspected `Finding`, revoke IRSA role → `kubectl rollout
   restart deployment/<app>` and suspend affected pod by scaling to 0 if
   confirmed compromised:
   ```bash
   kubectl -n wco-prod scale deployment/<app> --replicas=0
   ```
3. **Eradicate:** rotate secrets touched (SecretsManager), rebuild from a
   clean signed image, verify SBOM.
4. **Recover:** redeploy via the normal canary path.
5. **Post-mortem:** 1h with evidence; add regression control to CI.

## 3. Secret hygiene

- Secrets live in **AWS SecretsManager** under `wco/prod/<service>/...`;
  ESO projects them; IRSA limits read scope per service.
- Rotate DB/MQ passwords through the rotation lambda; never edit tfvars on a
  laptop mid-incident.
- gitleaks scans PRs; any leaked key → rotate immediately & revoke.

## 4. Access & privileges

- Humans: SSO (no long-lived user keys). Break-glass IAM user locked in a
  secure vault, monitored by GuardDuty.
- Code: IRSA roles only, scoped per namespace/service.
- After-hours fallible change requires a second pair of eyes (GitGuardian SLA).

## 5. Compliance mapping (NIST 800-53 / ISO 27001)

| Requirement | WCO evidence                                        |
|-------------|-----------------------------------------------------|
| AC-2 (access mgmt) | SSO + IRSA least-privilege, audit log          |
| SC-13 (crypto)     | KMS everywhere; TLS 1.3                      |
| AU-6 (audit review)| GuardDuty + Security Hub + deploy audit trail|
| SI-7 (integrity)   | cosign-signed images + SBOM                  |
| CP-9/10 (backup/DR)| nightly snapshots + DR cutover runbook       |

See Security Hub for live control status and continuous evidence export.
