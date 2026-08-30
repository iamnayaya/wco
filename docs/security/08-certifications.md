# Security Certifications & Attestation

WCO's security certifications, standards alignment, and how customers/partners obtain security attestations.

## Standards & posture

| Program | Status | Notes |
|---|---|---|
| **ISO/IEC 27001:2022** | Aligned / in program | Control baseline followed; see [Compliance certifications](../compliance/07-certifications.md) |
| **NIST 800-53** | Aligned | Security controls + evidence catalogue |
| **SOC 2** | Program in progress | Optional trust reporting (roadmap) |
| **PCI DSS** | Minimal scope (SAQ-A model) | [PCI DSS](../compliance/03-pci-dss.md); no PAN storage |
| **GDPR / NDPR / POPIA** | In compliance program | Data protection |

## What we attest to
- **AuthN/AuthZ** controls (JWT/refresh, RBAC, tenancy isolation).
- **Encryption** at rest + in transit (TLS 1.2+/1.3, AES-256, KMS).
- **App/network security** (WAF, default-deny network policies, secret hygiene).
- **Vulnerability management** (SAST/DAST/dependency scans, patch SLA).
- **Monitoring & incident response** (security monitoring, S1–S4 escalation).
- **Data protection** (rights, minimization, retention, breach notification).

## Obtaining attestation / security documents

To complete a **customer/partner security review** or vendor questionnaire:

1. Request our **security & compliance overview** and any public posture docs from **security@wco.com**.
2. A **non-disclosure agreement (NDA)** is generally required for detailed attestation documents and configuration specifics.
3. We respond with tailored evidence per the questionnaire against the standards above.

## Reporting

- **security@wco.com** — security questionnaires, attestation, reports.
- **privacy@wco.com** — data-protection/DPA requests.
- Vulnerability disclosure: [`SECURITY.md`](../../SECURITY.md).

## How certifications are maintained
- Continuous control evidence (Security Hub, audit logs) → [Compliance runbook](../runbooks/compliance.md).
- Annual readiness review; external assessments when a certification is held.
- Quarterly access + posture review ([Compliance playbook](../playbooks/07-compliance-playbook.md)).

## Related
- [Compliance certifications](../compliance/07-certifications.md)
- [Security overview](./01-security-overview.md)
- [Compliance runbook](../runbooks/compliance.md)
