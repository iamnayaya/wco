# Playbook: Compliance

How WCO maintains compliance posture, prepares for audits, and responds to regulatory requirements. The detailed requirements are in the [Compliance documentation](../compliance/README.md); this playbook is the operating process.

## 1. Governing frameworks
WCO maps controls to **NIST 800-53** and **ISO/IEC 27001:2022**, and complies with data-protection laws in our markets:
- **GDPR** (EU) · **NDPR** (Nigeria) · **POPIA** (South Africa) + equivalent laws in Ghana/Kenya.
- **PCI DSS** alignment for payment data (card data is handled by PCI-compliant providers; WCO minimizes its own card-data scope).

## 2. Continuous posture (not just at audit time)

| Activity | Cadence | Owner |
|---|---|---|
| Control evidence collection (Security Hub, audit logs) | continuous | Ops/Security |
| Data classification & handling review | quarterly | DPO/Legal |
| Access review (who has prod/admin access) | quarterly | Security |
| Vulnerability & dependency scan follow-up | continuous | Security/Eng |
| PII inventory & retention review | quarterly | DPO |
| Contract/DPA updates with processors | per onboarding | Legal |

## 3. Data protection & classification
- Follow the [data classification table](../runbooks/compliance.md#1-data-classification) (Public/Internal/Sensitive/Restricted).
- **Restricted** data never appears in logs, image layers, or commit history.
- Customer data handling follows [Retention](../security/README.md) and [data lifecycle](../database/data-lifecycle.md).

## 4. Handling data subject requests (DSRs)

A **DSR** is a customer/end-user request (access, correction, deletion, object):
1. Verify the requestor's identity.
2. Route to the DPO/escalation path.
3. Fulfill within the legal window (e.g., GDPR 30 days; prioritize per local law).
4. For requests on **merchant-submitted** data, coordinate with the merchant as data controller; WCO provides the tools (profiles, export, delete).
5. Log the DSR + resolution (audit trail).

## 5. Breach notification

Per GDPR/NDPR/POPIA, notify the relevant authority and affected parties within mandated timelines (e.g., GDPR 72h):
1. Confirm breach + assess risk (Security IC + Legal/DPO).
2. Prepare notification (what happened, data affected, mitigations, contact).
3. Notify regulator within the window; notify affected users per legal requirement.
4. Coordinate with the [Security incident playbook](./06-security-incident-playbook.md).
5. Document for the audit trail.

## 6. Audit preparation & execution

### Internal audit (annual + periodic)
- Collect evidence: policy docs, control evidence (Security Hub/CloudTrail/audit logs), data flow maps, contract/DPA inventory.
- Pre-review evidence for gaps **before** the auditor asks.
- Track findings as action items with owners/dates.

### External certification/audit (e.g., SOC 2, ISO 27001)
1. **Readiness review** — map controls, close gaps.
2. **Evidence warehouse** — one place (e.g., policy folder + automated evidence) for all controls.
3. **Walkthroughs & testing** with auditors.
4. **Manage findings** → remediation plan with owners.
5. **Certification issued** → public posture ([Compliance certs](../compliance/README.md#certifications)).

## 7. Vendor / processor management
- Evaluate processors (payment, logistics, AI, infrastructure) for security + DPAs before onboarding.
- Keep an inventory of processors + their data roles.
- Review subprocessors per DPA terms.

## 8. Training & awareness
- Annual security & privacy training for all staff.
- Role-specific training for DPO/security/finance-touching roles.
- Incident/tabletop drills include a data-breach scenario.

## 9. Escalation
- Regulatory request, imminent breach notification, or compliance finding → DPO/Legal immediately.
- Data-breach notification timeline is short — start the clock the moment a breach is confirmed.

## Cross-references
- Requirements: [Compliance documentation](../compliance/README.md)
- Evidence/control details: [Compliance runbook](../runbooks/compliance.md)
- Security posture: [Security documentation](../security/README.md) + [Security incident playbook](./06-security-incident-playbook.md)
