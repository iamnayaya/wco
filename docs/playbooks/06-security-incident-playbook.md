# Playbook: Security Incident

How to respond to a **confirmed** or **strongly suspected** security incident. This is a controlled, higher-sensitivity process — the security IC leads and information is shared on a need-to-know basis.

> **First action for everyone:** if you believe a security incident is occurring, **contact the security team immediately** — never "wait and see." Do not debug in public channels.

## 1. Confirm the incident (suspected → confirmed)

Signals that elevate a security incident:
- Unauthorized account access / credential compromise.
- Data exposure or suspected breach.
- Suspicious egress, permissions, or secret leakage.
- Injection/SQLi/XSS exploitation, malware, or runtime compromise.
- Payment/card data exposure (→ higher stakes, PCI obligations).
- Fraud patterns linked to WCO accounts.

**Known confidence:** a **security IC** confirms/adjusts severity per the blast radius and data sensitivity (same SLA table, but with security-specific escalation).

## 2. Roles

| Role | Responsibility |
|---|---|
| **Security IC** | Owns the security incident response; leads the bridge. |
| **Incident Commander (if converted from ops incident)** | Hands command to Security IC for security-confirmed events. |
| **Legal / DPO** | Involved early for breach notification + regulatory obligations (GDPR/NDPR/POPIA 72h breach notification). |
| **Comms (internal + external)** | Restricted, coordinated messaging. |
| **Forensics / Eng** | Preservation, containment, eradication, recovery. |

## 3. Response phases

### Containment (stabilize & isolate)
- **Isolate affected systems** without destroying evidence (snapshot, disable credentials, remove from network).
- **Rotate exposed secrets** per [Security runbook](../runbooks/07-security-runbook.md).
- **Revoke/suspend** compromised accounts/sessions/API keys.
- **Block** malicious traffic (WAF/IP) / disable abused flags.

### Eradication & recovery
- Remove malicious artifacts; patch the vulnerability (S1 priority).
- Restore from known-good backups ([Backup runbook](../runbooks/04-backup-recovery-runbook.md)) if data integrity is questionable.
- Re-enable services gradually; verify no re-infection.

### Preservation of evidence
- Preserve logs, memory/disk snapshots, and timestamps **before** cleanup.
- Follow the audit-trail guidance in [Compliance](../compliance/README.md).

## 4. Communication & notification
- **Internal:** `#security-incident` (restricted); brief leadership.
- **External:** coordinated status page wording via comms + legal — **do not** communicate breach specifics unilaterally.
- **Regulatory:** breach notification per [Compliance playbook](./07-compliance-playbook.md) (GDPR/NDPR/POPIA timelines) driven by Legal/DPO.
- **Customers:** notification only via approved channels when legally required.

## 5. Coordination on disclosure
- Follow [`SECURITY.md`](../../SECURITY.md) for the coordinated-disclosure stance.
- Don't publicly detail the vulnerability until a fix + communication plan is ready.

## 6. Post-incident
- **Post-mortem** (restricted version) per [Post-mortem playbook](./03-post-mortem-playbook.md) — S1 mandatory; include forensics findings.
- **Action items:** security hardening, monitoring additions ([Security runbook](../runbooks/07-security-runbook.md)), access review.
- **Retention of evidence** per compliance policy.
- Escalate recurring patterns to the security program ([Security monitoring](../security/06-security-monitoring.md)).

## Escalation matrix

| Trigger | Escalate to |
|---|---|
| Any suspected security event | Security IC immediately |
| Confirmed breach / PII or card exposure | Legal/DPO + leadership + security IC |
| Payment data (PCI scope) | PCI-required parties + [Compliance playbook](./07-compliance-playbook.md) |
| Extended/unknown attacker | External IR/forensics + threat intel |
