# GDPR Compliance

How WCO meets the requirements of the EU **General Data Protection Regulation (GDPR, EU 2016/679)**.

## 1. Roles

- **WCO (controller for account data; processor for merchant/customer data).** We act as a processor when merchants process their customers' data through WCO; we are a controller for the personal data we collect about our users/accounts.
- **Merchant (controller)** for their customers' data.
- **End users / customers (data subjects)** with rights over their data.

## 2. Lawful bases for processing

| Processing | Lawful basis (GDPR Art. 6) |
|---|---|
| Running the store / fulfilling orders | Contract (Art. 6(1)(b)) |
| Compliance (tax/invoicing) | Legal obligation (Art. 6(1)(c)) |
| Security & fraud prevention | Legitimate interest (Art. 6(1)(f)) |
| Marketing (with consent) | Consent (Art. 6(1)(a)) |

## 3. Data subject rights

WCO and merchants honor these rights through product features and processes:

| Right (Art.) | What it is | How fulfilled |
|---|---|---|
| **Access** (15) | know what data is held | customer profile; merchant export |
| **Rectification** (16) | correct inaccurate data | edit profile |
| **Erasure** (17) | request deletion | delete profile; GDPR erasure |
| **Restriction** (18) | limit processing | restriction process on request |
| **Portability** (18/20) | receive data in structured form | CSV export |
| **Object** (21) | object to processing (incl. marketing) | opt-out / "STOP" |
| **Withdraw consent** (7(3)) | withdraw marketing consent | opt-out |

> Merchants can fulfill most DSRs via the dashboard (profiles, export, delete). For help or complex requests → [Compliance playbook](../playbooks/07-compliance-playbook.md#4-handling-data-subject-requests-dsrs).

## 4. Data minimization & purpose limitation
- We collect only data needed to run the store/service.
- We don't use data for unrelated purposes.
- **Analytics are privacy-first** (cookieless, DNT-respecting) — see [Docs analytics](../platform-style/01-platform-setup.md#6-analytics).

## 5. Data protection by design & default
- Encryption at rest + in transit ([Security: Data encryption](../security/03-data-encryption.md)).
- Least-privilege access control ([Security: Authentication & authorization](../security/02-authentication-authorization.md)).
- Role-based store access (Owner/Admin/Agent/Viewer).
- Audit logging of sensitive operations.

## 6. Breach notification (GDPR Art. 33/34)
- We notify the supervisory authority **within 72 hours** of becoming aware of a breach involving personal data (where required) + affected data subjects when high risk.
- Processed via [Compliance playbook](../playbooks/07-compliance-playbook.md#5-breach-notification) + [Security incident playbook](../playbooks/06-security-incident-playbook.md).

## 7. Cross-border transfers & DPAs
- Data may be processed in cloud regions with appropriate safeguards.
- A **DPA** governs our processor role; merchants, as controllers, are covered by our Terms + this policy.
- Standard contractual clauses / adequacy safeguards apply for transfers out of the EEA.

## 8. Record of processing (RoPA) & accountability
- Maintain a record of processing activities, data flows, and lawful bases.
- Evidence & control documentation per [Compliance runbook](../runbooks/compliance.md).

## 9. Contact & DPO
- Privacy & DSR requests: support@wco.com / privacy@wco.com.
- DPO contact per our Privacy Policy (published at wco.com/privacy).
