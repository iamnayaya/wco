# Security Policy — WhatsApp Commerce OS (WCO)

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Email **security@wco.com** (monitored 24/7) or use GitHub's private vulnerability reporting.

Please include: affected service, reproduction steps, impact assessment, and any PoC. We acknowledge reports within **24 hours**, triage within **72 hours**, and coordinate disclosure with credit unless you prefer anonymity. Safe-harbor: good-faith research will not be pursued legally.

## Supported Versions

| Version | Support |
| ------- | ------- |
| latest `main` release | ✅ full support + security patches |
| previous minor | ✅ critical patches only |
| older | ❌ upgrade required |

## Our Security Posture (summary)

Full details in [`docs/architecture/security-plan.md`](docs/architecture/security-plan.md).

- **AuthN/AuthZ**: JWT (15-min access, rotating refresh), RBAC + store-scoped tenancy guards, API keys for server-to-server.
- **Encryption**: TLS 1.2+ in transit (1.3 preferred); AES-256 at rest (RDS/EBS/S3/KMS); app-level envelope encryption for merchant tokens via AWS KMS.
- **Secrets**: AWS Secrets Manager + SSM Parameter Store. Never in git. CI uses OIDC federation — no long-lived cloud keys.
- **API**: Helmet headers, per-IP + per-merchant rate limits, strict CORS allowlist, Zod/class-validator input validation, webhook HMAC signature verification (Meta x-hub-signature-256, Paystack/Flutterwave/OPay signatures).
- **Compliance targets**: NDPR (Nigeria), GDPR (EU merchants), PCI-DSS SAQ-A scope (card data never touches our servers — hosted checkout/tokenization by PSPs).
- **SDLC**: CodeQL SAST, Dependabot + Trivy dependency/container scanning, secret scanning (gitleaks), mandatory 2-reviewer approval, signed commits.

## Incident Response

Severity ladder S1–S4 with on-call escalation via PagerDuty; breach notification procedures aligned to NDPR 72-hour requirement.
