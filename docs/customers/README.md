# Customer CRM

The customer domain is the memory of the store: every WhatsApp conversation,
order, and manual touchpoint resolves back to one `Customer` row keyed by a
**normalized phone number per store**. This document describes the v2 module
(`src/modules/customers/`), which replaced the original cursor-list prototype
with an offset-paginated directory, a tag catalog, a notes timeline, and an
AI segmentation engine.

```
                       +---------------------------+
   WhatsApp in/out ---> |  conversations/messages  |
                       +------------+--------------+
                                    | customerId
   Orders / POD -------------------->+
                                    |
   CSV import ----------------------v
                       +---------------------------+     denormalized
   Manual edits ------->    CustomerDirectory     <---- tags[] mirror
                       |  (per-store, waPhone key) |
                       +----+----------+------+----+
                            |          |      |
              +-------------+          |      +---------------+
              v                        v                      v
       /customer-tags           /customers/:id/notes    /customer-segments
       (catalog + assign)       (pinned timeline)       (manual + AI engine)
```

## Directory (`directory.service.ts`)

- **Identity**: `waPhone` normalized through `normalizePhone()` (local trunk
  zero, missing country code, E.164 passthrough). Unique per store via the
  `storeId_waPhone` compound index; duplicates raise `409 CONFLICT`.
- **List (GET /customers)**: offset pagination (`page`, `pageSize<=100`) with
  `meta.pagination = {page, pageSize, totalItems, totalPages}`.
  Filters: `q` (name/phone/email OR-search), `tag` (scalar-list `has`),
  `segment`, `marketingOptIn`, `minSpent`/`maxSpent`.
  Sort keys are whitelisted: `createdAt|name|totalSpent|ordersCount|lastOrderAt`
  - anything else is a 422, never an injection surface.
- **Delete** is GDPR Art.17 style: notes and segment memberships cascade in one
  transaction; the order ledger is intentionally untouched (financial records).
- **Stats snapshot** (`GET /:id/stats`) returns LTV/AOV/recency from the cached
  rollup columns plus a live order aggregate for first/last-order timestamps.
- **Feeds**: `/:id/orders` and `/:id/messages` power the 360 pane; messages are
  resolved through the customer's conversations (two-step query).

## Tag catalog (`crm.service.ts` - CustomerTagService)

Tags exist in two places by design:

1. `customer_tags` - the per-store catalog (unique name, optional hex color).
2. `customers.tags` - a denormalized string array used for fast filtering.

Assignment/removal/deletion keeps both in sync. Deleting a tag strips it from
every holding customer so filters never dangle.

## Notes timeline (`CustomerNoteService`)

Free-form context on a customer ("prefers evening delivery"). Notes are
store-scoped through the owning customer, support `pinned` (sorted pinned-first,
then newest), and record the authoring user when the request is user-JWT
authenticated (API-token imports get `authorId = null`).

## Segmentation engine (`AutoSegmentService`)

`POST /customer-segments/auto` runs the rule engine for the active store. It is
idempotent and cron-safe: call it nightly (e.g. `0 3 * * *` in the worker's
BullMQ repeatable jobs) or from the UI button.

System segments (created on demand, `isSystem: true`, rules locked):

| Segment   | Rule                                              | Intent                    |
| --------- | ------------------------------------------------- | ------------------------- |
| VIP       | lifetime spend >= 50,000                          | white-glove treatment     |
| FREQUENT  | >= 5 orders and spend < 50,000                    | loyalty nudges            |
| NEW       | created <= 30 days ago with <= 1 order            | onboarding flow           |
| ONE_TIME  | exactly 1 order idle >= 31 days                   | second-purchase win-back  |
| AT_RISK   | >= 2 orders idle between 30-90 days               | re-engagement campaign    |
| DORMANT   | idle >= 91 days                                   | sunset/reactivation blast |

Run semantics:

1. Ensure all six system segments exist (no-op when present).
2. Load store customers as `{totalSpent, ordersCount, lastOrderAt, createdAt,
   marketingOptIn}` and evaluate each segment's AND-composed rule
   (`matchesRule` - pure, unit-tested). Empty rules never auto-match;
   manual-only membership is preserved.
3. Diff desired vs current memberships; insert/remove only deltas.
4. Stamp `lastComputedAt`; sync the legacy `customers.segment` column with the
   customer's highest-priority bucket so cheap list filters stay accurate.

Manual segments accept the same rule shape; memberships can also be managed by
hand (`POST/DELETE /customer-segments/:id/customers/:customerId`, idempotent).

## CSV import/export (`import-export.service.ts`)

- **Export** streams RFC 4180 CSV (UTF-8 BOM + CRLF for Excel) with
  formula-injection neutralization (`=`, `+`, `-`, `@` prefixed cells).
- **Import** enforces: size <= 10MB, csv-ish MIME/extension, a `phone` column
  (case/space tolerant), optional `name|email|tags|marketingOptIn`. Tags split
  on `;` or `|`. Rows are isolated - one bad row never aborts the batch; the
  report returns `{created, skippedDuplicates, errors:[{row, error}]}` where
  `row` counts humans-first (header = row 1).

## Conventions & guards

- Every route chains `authenticate()` + `tenantScope()`; mutations additionally
  require `store:write` (VIEWERs read-only). Cross-store ids answer `404`,
  never `403`, to avoid existence leaks.
- Literal paths (`/search`, `/export`, `/import`) are registered before `/:id`.
- RBAC, audit logging (`customer.create|update|delete|import`), and error
  envelopes follow the platform standards in the root README.
