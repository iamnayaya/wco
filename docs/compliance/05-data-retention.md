# Data Retention

How long WCO keeps different categories of data and how deletion works, balancing business needs with legal/tax obligations and user rights.

## 1. Retention principles
- **Keep data only as long as needed** for the purpose it was collected (data minimization).
- **Legal/tax obligations** (invoicing, regulatory records) may require longer retention (e.g., transaction records for tax periods).
- **User rights** (GDPR erasure) let users request deletion where no legal obligation to retain exists.
- Define retention per data category; automate deletion where possible.

## 2. Retention schedule (indicative)

| Data category | Retention | Basis / notes |
|---|---|---|
| Account & profile | While account active + short grace | contract; delete on account deletion |
| Orders & transactions | Legal/tax window (e.g., 6–7 years for tax/accounting where required) | legal obligation; may outlive account deletion |
| Customer profiles | While business relationship + legal window | contract/legitimate interest; erasable on request unless order records require retention |
| Conversations/messages | As needed for business + support; limited retention | legitimate interest; minimized |
| Payments (token/status) | As needed + provider/tax windows | no PAN stored ([PCI DSS](./03-pci-dss.md)) |
| Logs & audit trails | 30 days (app logs) to longer (audit) | [Audit trail](./06-audit-trail.md) |
| Inactive/abandoned accounts | Policy-based (e.g., notify then delete after long inactivity) | minimization |
| Backups | Snapshot/PITR retention window (e.g., ~35 days) | recovery; not a release valve for the above |

> Exact retention periods and automation are owned by the DPO/data team. Public-friendly figures are published in the [Privacy Policy](https://wco.com/privacy).

## 3. Deletion & erasure
- **Merchant can delete** a customer profile (order records may be retained for tax/legal).
- **DSR erasure:** honoring deletion when no legal retention obligation applies — via the [Compliance playbook](../playbooks/07-compliance-playbook.md#4-handling-data-subject-requests-dsrs).
- **Account deletion:** on full account deletion, store data is handled per the schedule; you can **export** first ([Export](https://wco.com/privacy)).

## 4. Automated vs manual
- **Automated** where feasible (log lifecycle/expiry).
- **Manual/scheduled** for complex objects requiring legal reconciliation.
- Retention is reviewed quarterly as part of [Compliance playbook](../playbooks/07-compliance-playbook.md#2-continuous-posture).

## 5. Related
- [Data lifecycle & archival](../database/data-lifecycle.md) — technical handling/archival.
- [GDPR erasure](./01-gdpr.md) · [NDPR](./02-ndpr.md)
- [Audit trail](./06-audit-trail.md)
