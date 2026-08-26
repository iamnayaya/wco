# Order Management (v2)

Orders are money in motion. The v2 module (`src/modules/orders/`) completes the
checkout skeleton with a hard state machine, an audited status trail, line-item
resyncs, team notes, a refund ledger, cancellation records with restock
control, a merged timeline, WhatsApp sync, AI heuristics, and CSV in/out.

```
   CSV in/out ---------> +---------------------+     Idempotency-Key ----+
   Dashboard/WA -------->|  orders (tenant)    |<---- auto-customer from |
                         |  orderNumber unique |      customerPhone      |
                         +--+-------+-------+-+                         |
                            |       |       |                           |
             /:id/status    |       |       |        /:id/items/:itemId
             state machine -+       |       +- line resync (qty/note):
             + history rows         |          totals & stock re-balance
             + lifecycle stamps     |         atomically, 409 oversell
             + outbox events        |
                                    v
        /:id/refunds (OWNER+)  /:id/cancellations (OWNER+)   /:id/timeline
        PENDING -> process     cancel + record + restock     statuses+notes+
        rail seam; full ->     flags at process time         refunds merged
        REFUNDED                                             oldest-first
```

## Layout

- `orders.routes.ts` - route wiring; literal paths (`/v2`, `/search`, `/export`,
  `/import`, `/stats`, `/sync-whatsapp`) register before `/:id`. Reads open to
  the team; mutations need `order:write`; anything that moves real money or
  stock (refund/cancellation lifecycle) is OWNER/ADMIN via `requireRole`.
- `services/` - one service per concern through `barrel.ts`:
  `orders.service.ts` (checkout, transitions, listing v2/search/stats),
  `items.service.ts`, `notes.service.ts`, `status-history.service.ts`
  (audit + current-status), `refunds.service.ts`, `cancellations.service.ts`,
  `ai.service.ts`, `import-export.service.ts`, `whatsapp.service.ts`, plus
  `shared.ts` (`requireOrderWithItems` tenant guard).

## Checkout (`orders.service.ts`)

- Money is computed server-side from current product prices; lines snapshot
  `productName/sku/unitPrice` so later catalog edits never rewrite history.
- Stock decrements inside the creation transaction with a conditional
  `updateMany ... gte` guard - races answer `409 INSUFFICIENT_STOCK` naming the
  offender. Untracked products skip the guard.
- A phone without a matching customer auto-creates one (`upsertByPhone`);
  `customerId` wins when both arrive.
- `discount` and `deliveryFee` participate in the total; totals are kobo-exact.
- `Idempotency-Key` replays return the cached first response (200 +
  `Idempotent-Replayed`) instead of double-charging stock.

## State machine + audit

`ORDER_TRANSITIONS` is the single source of truth
(`PENDING_PAYMENT -> PAID|CANCELLED -> PROCESSING -> SHIPPED -> DELIVERED`,
with `REFUNDED` reachable from paid states). Every hop:

- rejects illegal jumps with `409 CONFLICT` and tolerates idempotent repeats;
- refuses `PAID` when a PSP payment row says `FAILED` unless the rail is
  offline (`CASH`/`BANK_TRANSFER`) - failed card captures never become paid;
- stamps lifecycle timestamps (`paidAt/shippedAt/deliveredAt/cancelledAt`),
- appends an `OrderStatusHistory` row with the acting user,
- emits a domain event through the transactional outbox.

Paid money never disappears through the bare endpoint: cancelling after payment
requires the cancellations sub-resource.

## Line items (`items.service.ts`)

Quantity updates and deletes re-run the same math as checkout inside one
transaction: totals resync, stock rebalances symmetrically (raises re-check
availability with `409`, deletes restore units), and the last remaining line is
refused so an order can never strand without items.

## Notes (`notes.service.ts`)

Team-visible notes with authorship rules: edits/deletes belong to the author or
OWNER/ADMIN (`403` otherwise), bodies validate against length bounds, listing
sorts pinned-first then newest.

## Refund ledger (`refunds.service.ts`)

OWNER/ADMIN territory. Creation validates a paid order (`409` when unpaid) and
the refundable balance (`422` over over-refunding); rows start `PENDING`.
Edits/deletes are PENDING-only and processing is immutable once terminal.
`process` executes through the payment-rail seam - provider failures land the
row `FAILED` and leave the order paid; full coverage flips the order to
`REFUNDED` with its own audit row while partials leave status alone. Tests
simulate failures with `REFUND_RAIL_FORCE=fail`.

## Cancellations (`cancellations.service.ts`)

Delivered orders are guarded toward refunds instead. Creating a record moves
the order to `CANCELLED`, blocks duplicates (`409`), and stores restock intent;
`process` executes the restock per stored flags exactly once. Reasons are
amendable (`PATCH`) and records deletable while they exist.

## Listing, search, stats, timeline

- Legacy `GET /orders` keeps cursor pagination for shipped clients; `GET /v2`
  adds offset pages (`page/pageSize`), whitelisted sort keys, status/channel/
  total/date filters, and buyer decoration for search matches on number
  suffix, name, or phone digits. `GET /search` aliases v2 semantics.
- `GET /stats` rolls counts/revenue/rates per store.
- `GET /:id/timeline` merges status moves, notes, and refunds into one feed
  sorted oldest-first.

## WhatsApp sync + AI (`whatsapp.service.ts`, `ai.service.ts`)

`POST /sync-whatsapp` queues open orders to buyers and reports
`{queued, skippedClosed, failed}`; the transport sits behind a seam
(`WHATSAPP_SYNC_FORCE=fail` simulates provider errors). AI endpoints always
answer - heuristically without `OPENAI_API_KEY`:

- `POST /:id/predict-fulfillment` - base days plus pickup/bulk/city-distance
  adjustments with explainable `basis[]` and confidence that decays with each
  adjustment.
- `POST /:id/fraud-check` - weighted signals (`HIGH_VALUE`,
  `NEW_CUSTOMER_HIGH_VALUE`, `NO_ADDRESS`, `BULK`, `ROUND_AMOUNT`) scored to
  `LOW/MEDIUM/HIGH`, persisted as the order's `fraudScore` with
  `flaggedForReview`.

## CSV export/import (`import-export.service.ts`)

Export emits RFC 4180 CSV with a UTF-8 BOM for Excel and the documented
header. Import runs rows through real checkout semantics (SKU resolution,
stock guards, auto-customers) and isolates bad rows as
`{row, error}` with humans-first numbering; wrong MIME or missing files
answer `422`.

## Conventions & guards

- Every route chains `authenticate()` + `tenantScope()`; foreign ids answer
  `404`, never leaks. VIEWERs read; writes need `order:write`; money/stock
  lifecycle needs OWNER/ADMIN.
- Status/history/timeline reads stay open to the team - support needs context,
  not write access.
- Error envelopes, audit logging, and idempotency follow the platform
  standards documented in the root README.
