# Data Residency

Where WCO stores data and the regional safeguards applied, so we meet local data-residency and regulatory expectations.

## 1. Where data is stored

WCO is hosted on **AWS** in multiple regions. Primary data (PostgreSQL/RDS, Redis, S3) and application workloads are deployed in regions that satisfy our markets' requirements, with **cross-region backup replication** for disaster recovery ([DR runbook](../runbooks/dr.md)).

| Data plane | Primary region(s) | DR replication |
|---|---|---|
| PostgreSQL (RDS) | Primary region | encrypted snapshots → DR region |
| Object storage (S3) | Primary region | cross-region replication → DR region |
| Application workloads | Primary region (EKS) | DR-capable per [DR runbook](../runbooks/dr.md) |
| Search (Elasticsearch) | Primary region | snapshot repository |
| Cache (Redis) | Primary region | ephemeral (no cross-region) |

> Specific region names and the current DR topology are operational details managed in IaC (`infra/terraform`) and the [DR runbook](../runbooks/dr.md); they're intentionally kept out of public docs. Contact privacy@wco.com for residency attestation.

## 2. Regional compliance
- **Nigerian/Ghanaian/Kenyan data subjects:** data is processed under laws like NDPR/POPIA with appropriate safeguards; where a local presence/regulator requires, we align storage and access accordingly.
- **EU data subjects (GDPR):** transfers out of the EEA use appropriate safeguards (SCCs/adequacy) — see [GDPR](./01-gdpr.md).
- We review region choices when entering/expanding markets.

## 3. Access & control of data location
- **Third-party processors** (payment, logistics, AI, infra) may process data in their own regions under their DPAs ([Compliance playbook](../playbooks/07-compliance-playbook.md#7-vendor--processor-management)).
- Customers/merchants retain control of their data (export/delete) regardless of storage region ([Data retention](./05-data-retention.md)).

## 4. Guarantees
- Data is **encrypted at rest** in every region ([Data encryption](../security/03-data-encryption.md)).
- Backup is replicated off-region for resilience but still within our controlled cloud footprint.
- We do not store data in regions that conflict with our documented compliance posture.

## 5. Questions & attestation
- For residency attestation or a specific regulatory request: **privacy@wco.com**.
