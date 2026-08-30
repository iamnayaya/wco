# Network Security

How WCO protects its network perimeter and internal traffic.

## Edge & perimeter

| Layer | Control |
|---|---|
| **CDN / edge** | AWS CloudFront (global, TLS 1.3, HTTP/2/3) |
| **WAF** | AWS WAF — SQLi/XSS rules, rate-based rules, bot mitigation, geo allowlists where appropriate |
| **DDoS protection** | AWS Shield (Standard/Advanced) + CloudFront edge absorbing volumetric attacks |
| **Load balancing** | ALB/NLB internal; internet-facing traffic enters via edge |

## Internal network

- **Default-deny NetworkPolicies** (Kubernetes): services can only reach what they're allowed to.
- **Egress allowlists per service** — a compromised service can't phone home arbitrarily.
- **Private subnets** for databases/cache/queues — not publicly reachable.
- **TLS/mTLS** for service-to-service where required; traffic within the cluster remains encrypted in transit.

## Webhook & external callbacks
- Inbound webhooks (WhatsApp, payment providers) validated by **HMAC signature** and timestamp replay checks — fail closed ([Webhooks](../api/webhooks.md)).
- Outbound calls to providers (payments, logistics, AI) use TLS with allowlisted endpoints.

## Access to the network
- **No public SSH**; admin access via bastion/SSO with MFA and audit.
- **Production access** is break-glass or via IRSA/role-based identities (no shared static cloud keys).
- **Secrets** never traverse the network in plaintext (Secrets Manager over TLS).

## WAF rule management
- Managed rule sets (SQLi, XSS, bad bots) enabled by default.
- Custom rules added per threat (rate limits, specific payload patterns).
- WAF is monitored; blocked-rate anomalies are investigated ([Monitoring](./06-security-monitoring.md)).

## Related
- [Security overview](./01-security-overview.md)
- [Security runbook](../runbooks/07-security-runbook.md) (hardening)
- Architecture security plan: [`docs/architecture/security-plan.md`](../architecture/security-plan.md)
