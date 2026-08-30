# Known Issues

Documented, currently-known issues and their workarounds. This is a living list — keep it current as items are fixed and new ones appear. When an issue is resolved, move it to the changelog and remove it here.

> Each entry: **Status** (Open / Workaround / Fixed / Resolved-in <version>), the impact, and the workaround.

## Current known issues

### KI-001 — AI occasionally misprices a variant product (Open)
- **Impact:** The AI auto-responder may quote the base product price instead of a selected variant's price for some variant catalogs.
- **Workaround:** Merchants should enable **handoff** for buying-intent messages and keep base prices accurate; customers can be corrected in the thread. We're improving variant-aware catalog context.
- **Owner:** AI team reference: `@wco/ai-engine`.

### KI-002 — Payment reflection can lag up to ~1 min on some providers (Workaround)
- **Impact:** Order shows "Pending/Paying" briefly after the customer pays.
- **Workaround:** There's no action needed; the webhook updates automatically. For support: confirm the customer actually paid, then wait for the webhook; escalate only if it exceeds the provider's SLA.

### KI-003 — Delivery tracking updates may be delayed on weekends (Workaround)
- **Impact:** GIG/Kwik/Sendy tracking may not update in real-time on weekends/holidays.
- **Workaround:** Share the provider's live tracking link; reassure customers delivery status updates on provider working days.

### KI-004 — Large CSV imports can exceed upload time limits (Workaround)
- **Impact:** Very large product catalog imports may time out.
- **Workaround:** Split imports into batches (<1,000 rows) or use the API for bulk operations.

### KI-005 — Web login with magic-link can be blocked by aggressive spam filters (Workaround)
- **Impact:** Some users don't see the magic link/login email.
- **Workaround:** Suggesting "Forgot password" (SMS) or checking spam. Improving deliverability is underway.

## Resolved recent issues
*(Sample — treat as illustrative; the live list moves these here.)*

| ID | Issue | Resolved in |
|---|---|---|
| KI-00X | Occasional duplicate order on fast double-tap of "Confirm" | v1.1.1 (idempotency fix) |

## How this list is maintained
- New items are added by support when a known issue is identified (see [Resolution guide](./03-resolution.md) — document recurring fixes).
- Items are **workaround-highlighted** so support resolves fast.
- When fixed, moved to the [Changelog](../developer/13-changelog.md) and removed here.
- Reviewed weekly by the support lead against open/closed bug counts.

## Related
- [Common issues](./01-common-issues.md) (recurring but resolvable)
- [QA defect process](../qa/process.md) (how bugs are tracked & SLAs)
- [Status page](https://status.wco.com) (ongoing incidents/outages)
