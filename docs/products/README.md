# Product Catalog (v2)

The product domain is what the store sells and how much of it exists. The v2
module (`src/modules/products/`) completes the original CRUD skeleton with
variants, image assets, a category/tag taxonomy, an append-only inventory
ledger, store-scoped discount codes, CSV import/export, AI enrichment
heuristics, and WhatsApp catalog sync.

```
   CSV in/out ---------> +--------------------+      include: variants,
   Manual edits -------> |  products (store)  | <---- imageAssets, tagLinks,
   AI categorize ------> |  sku unique/store  |      category
                         +----+----------+----+
                              |          |
             +----------------+          +----------------+
             v                v                           v
      /products/:id/    /products/:id/discounts        /inventory (+ /low-stock)
      variants|images|  (PERCENTAGE/FIXED codes)       ledger: RESTOCK/SALE/
      tags|ai/*                                         DAMAGE/CORRECTION
             |
             v
   /products/sync-whatsapp ---> WhatsApp catalog push (retailerId/name/imageUrl)
```

## Layout

- `products.routes.ts` - route wiring; literal paths (`/search`, `/export`,
  `/import`, `/stats`, `/sync-whatsapp`, `/categories`) are registered before
  `/:id` so Express never swallows them as an id.
- `services/` - one service per concern, all exported through `barrel.ts`:
  `catalog.service.ts` (categories v2 + tag catalog), `variants.service.ts`,
  `images.service.ts`, `discounts.service.ts`, `inventory.service.ts`,
  `import-export.service.ts`, `enrichment.service.ts`, plus `shared.ts`
  (`requireProduct` tenant guard, Prisma unique-violation mapper).

## Variants & images

- Variants are soft-deleted children with their own per-store-unique SKU; the
  parent's `stockQuantity` mirrors the sum of variant stock after every create,
  update, adjust, and delete (`syncParentStock`). Untracked parents skip resync.
- Images upload through multer (single `image` field; jpg/png/webp <= 5MB),
  land on the uploads service, and enforce exactly one primary per product:
  the first upload is auto-primary, deleting the primary promotes the next
  image by position, and `POST .../images/:imageId/primary` demotes siblings.

## Taxonomy (`catalog.service.ts`)

Categories and tags are per-store catalogs with unique names (`409` on dupes).
Tags attach to products through an explicit m2m (`ProductTagOnProduct`), so a
tag rename propagates everywhere and deletion strips links - filters never
dangle. Replacing a product's tags (`PUT /products/:id/tags {names}`) upserts
unknown names, links, and prunes dropped links. Deleting a category nulls the
`categoryId` on holding products (mirrors the FK `SetNull`) instead of failing.

## Inventory ledger (`inventory.service.ts`)

Every stock change appends an `InventoryLedger` row:
`{type: RESTOCK|SALE|DAMAGE|CORRECTION, delta, resultingQuantity, note}`.
Semantics:

- `setQuantity` writes an entry whose delta reconciles old -> new.
- Delta adjustments floor at zero (damage can't go negative).
- Untracked products (`trackStock: false`) accept adjustments as no-ops -
  no ledger noise for services priced per unit.
- `GET /inventory` lists levels store-wide; `GET /inventory/low-stock` returns
  tracked products at or below threshold.

## Discounts (`discounts.service.ts`)

Store-scoped codes (`storeId_code` unique) typed `PERCENTAGE` (hard-capped at
90) or `FIXED`. `computeDiscountedPrice` floors at zero and rounds to kobo;
liveness checks window (`startsAt/endsAt`) and `active` flag. Applying a code
returns `{originalAmount, discountedAmount, savings}` without mutating state.

## CSV import/export (`import-export.service.ts`)

- **Import**: size/MIME guards, case/space-tolerant headers (`name`, `sku`,
  `price` required; optional `description|category|tags|stockquantity|...`).
  Rows match existing products by `(storeId, sku)` for update-or-create.
  Bad rows are isolated: `{created, updated, failedRows:[{row, error}]}` with
  humans-first row numbering (header = row 1).
- **Export**: same filter surface as list v2 (`status`, `categoryId`, price
  bounds, `q`); emits RFC 4180 CSV with category names and `;`-joined tags
  resolved through flat lookups (no N+1 decoration).

## AI enrichment (`enrichment.service.ts`)

Three endpoints per product, each with a deterministic fallback so the API
works without `OPENAI_API_KEY`:

- `POST /:id/ai/describe` - LLM copy (gpt-4o-mini, 8s abort) or tone-based
  heuristic (`friendly | professional | promotional`) from name/category/price.
  Response marks its `source: llm | heuristic`.
- `POST /:id/ai/price` - cost-floor x margin, compareAt anchoring, stock
  pressure; persists a `PriceSuggestion` row (`PENDING` for human review) and
  answers `201 {suggestedPrice, rationale, confidence, suggestionId}`.
- `POST /:id/ai/categorize` - keyword dictionary guess
  (`guessCategoryName`, pure + unit-tested) mapped onto the store's categories,
  creating the category when missing.

WhatsApp sync (`POST /products/sync-whatsapp`) builds catalog entries
(retailerId <= 64, name <= 200, imageUrl <= 2048) from ACTIVE tracked products
and reports `{synced, skippedNoWhatsApp, failed}`. The actual push sits behind
the `push()` transport seam; set `WHATSAPP_CATALOG_PUSH=fail` in tests to
simulate provider errors.

## Conventions & guards

- Every route chains `authenticate()` + `tenantScope()`; mutations require
  `store:write` (VIEWERs read-only). Cross-store ids answer `404`.
- List v2 uses SQL pagination normally; low-stock and tag filters run over the
  full match set in JS (small-catalog tradeoff) using link-table queries rather
  than trusting `include` hydration.
- Sort keys stay whitelisted; RBAC, audit logging, and error envelopes follow
  the platform standards in the root README.
