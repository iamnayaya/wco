# Security Policy

## Reporting a vulnerability

**Email: security@wco.africa** (monitored 24/7). Do **not** open a GitHub issue for security reports.

We commit to:

- Acknowledgment within **24 hours**
- Triage + severity (CVSS) within **72 hours**
- Fix or mitigation timeline shared for SEV1/SEV2 within **7 days**

Safe harbor: good-faith research against `*.wco.africa` and our public apps is welcome; stay within your own test accounts and data.

## Platform security model (summary)

Full details: `docs/architecture/security-plan.md`.

| Layer | Control |
|---|---|
| AuthN | Short-lived JWTs (15m) + rotating single-use refresh tokens (reuse = family revocation) |
| AuthZ | Permission strings per route (`orders:create`, …); OWNER/MANAGER/AGENT roles |
| Tenancy | Store-scoped queries via TenantContext guard; RLS policies in schema as backstop |
| Transport | TLS everywhere; HSTS; webhook HMAC verification fails closed |
| Secrets | AWS Secrets Manager → External Secrets Operator; never in Git; 90-day rotation |
| Containers | Distroless-ish Alpine, non-root UID 10001, read-only rootfs, all caps dropped, seccomp RuntimeDefault |
| Network | Default-deny NetworkPolicies; egress allowlists per service |
| Rate limits | Global 100/min; login 8/15min/email; payment endpoints stricter |

## Supported versions

Only the latest release line receives security patches. Deploys are continuous — there are no LTS branches.
