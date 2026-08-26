# WCO Public API — v1 Documentation

> **Canonical reference for the WhatsApp Commerce OS merchant-facing API.**
> Base URL (prod): `https://api.wco.africa/api/v1` · Dev: `http://localhost:4000/api/v1`
> OpenAPI spec: [`openapi.yaml`](./openapi.yaml) · Interactive docs (non-prod): `http://localhost:4000/api/docs`

---

## Document map

| Document | Contents |
|---|---|
| [architecture.md](./architecture.md) | API architecture, gateway design, service communication, auth flows |
| [design-guidelines.md](./design-guidelines.md) | REST conventions, status codes, error catalog, pagination, filtering, versioning, idempotency |
| [authentication-authorization.md](./authentication-authorization.md) | JWT lifecycle, OAuth 2.0 client-credentials, API keys, RBAC matrix, store scoping |
| [security.md](./security.md) | OWASP alignment — CORS, CSRF, validation, injection & XSS prevention, headers |
| [performance.md](./performance.md) | Caching (ETag/Redis), compression, partial responses, batching, pagination perf |
| [observability.md](./observability.md) | Metrics, structured logging, tracing (OpenTelemetry), alerting rules, SLOs |
| [testing.md](./testing.md) | Unit → integration → E2E pyramid, contract tests, load & security testing |
| [webhooks.md](./webhooks.md) | Outbound webhook signing/retries + inbound provider webhook routing |
| [graphql.md](./graphql.md) | GraphQL endpoint, schema principles, when to use vs REST |
| [examples.md](./examples.md) | cURL / JavaScript / Python recipes, Postman collection, SDK generation |
| [openapi.yaml](./openapi.yaml) | **Complete OpenAPI 3.1 specification** (source of truth for codegen) |

Related: [Database docs](../database/README.md) · [System architecture](../architecture/system-architecture.md)

---

## Quickstart

### 1. Authenticate

```bash
curl -s -X POST https://api.wco.africa/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@wco.app","password":"Demo1234!"}'
```

```json
{
  "accessToken": "eyJhbGciOi...",   // JWT, 15 min
  "refreshToken": "rt_9f2c...",     // opaque, 7 days, single-use rotation
  "expiresIn": 900,
  "user": { "id": "usr_...", "merchantId": "mrc_...", "role": "OWNER", "stores": ["str_..."] }
}
```

### 2. Call a tenant-scoped endpoint

Every business resource is scoped to a **store**. Merchants with one store may omit the header;
multi-store merchants must select context per request:

```bash
curl -s https://api.wco.africa/api/v1/orders?limit=20 \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Store-Id: str_demo_store"
```

### 3. Machine-to-machine access (third-party integrations)

```bash
curl -s https://api.wco.africa/api/v1/products \
  -H "X-API-Key: wco_strde_9xK..."        # store-scoped key, shown once at creation
```

Full credential matrix → [authentication-authorization.md](./authentication-authorization.md).

---

## Core contracts (30-second version)

| Concern | Contract | Details |
|---|---|---|
| Versioning | URL path `/api/v1/*`; additive changes only within v1 | [Versioning](./design-guidelines.md#8-versioning--deprecation-policy) |
| Errors | `{ "code": "NOT_FOUND", "message", "details", "requestId" }` — stable machine codes | [Error catalog](./design-guidelines.md#5-error-handling) |
| Pagination | Cursor-first (`?cursor=&limit=`), offset available on small sets | [Pagination](./design-guidelines.md#6-pagination-filtering-sorting-search) |
| Idempotency | `X-Idempotency-Key` on all unsafe POST/PUT; 24 h replay window | [Idempotency](./design-guidelines.md#7-idempotency) |
| Concurrency | Optimistic locking via `ETag` / `If-Match` on mutable aggregates | [Concurrency](./design-guidelines.md#9-concurrency-control) |
| Tenancy | `X-Store-Id` selects active store; membership verified server-side; RLS enforced in DB | [Tenancy](./authentication-authorization.md#5-store-scoping-multi-store) |
| Money | Major units as strings in JSON (`"1500.50"` = ₦1,500.50); ISO 4217 `currency` field | [Money](./design-guidelines.md#11-money-dates-and-locales) |
| Dates | RFC 3339 UTC (`2026-02-01T12:00:00Z`) | — |
| Rate limits | Redis sliding window; tiers per route class; `RateLimit-*` response headers | [Limits](./design-guidelines.md#12-rate-limit-tiers) |

## Endpoint surface (summary)

~110 endpoints across 16 modules. Full detail lives in [openapi.yaml](./openapi.yaml);
human-readable tables per module are in [endpoints reference appendix](./design-guidelines.md#appendix-endpoint-matrix).

```
auth            register login logout refresh me password flows          public+JWT
users           seller/team management (merchant admin)                  OWNER/ADMIN
stores          multi-store CRUD, WhatsApp connect                       OWNER/ADMIN
customers       CRM profiles, segments, tags, GDPR export/delete         AGENT+
products        catalog CRUD, variants, stock adjust, search             AGENT+
orders          order lifecycle, items, stats                            AGENT+
messages        threads (conversations), send, bot takeover              AGENT+
payments        links, verification, refunds, PSP webhooks               AGENT+
payment-methods merchant payout accounts                                 OWNER
deliveries      quotes, booking, tracking                                AGENT+
delivery-providers   platform logistics registry                         read: all · write: platform
subscriptions   plans, subscribe, cancel, billing webhooks               OWNER
ai-configs      AI brain settings + response templates                   OWNER/ADMIN
analytics       sales/customers/products/messages/dashboard              VIEWER+
webhooks        outbound subscription management + test fire             OWNER/ADMIN
whatsapp        number connect/status/disconnect, Meta webhooks          OWNER
platform        health, status, metrics                                  public/admin
graphql         complex read aggregation                                 JWT/API-key
```

## Legacy path aliases (v0 dashboard compat)

The first-generation dashboard shipped against these paths; both resolve identically today.
They will be removed in **v2** (announced ≥ 180 days ahead via `Sunset` headers):

| Canonical (v1) | Legacy alias (still served) |
|---|---|
| `GET /deliveries`, `GET /deliveries/:id/track` | `GET /logistics/shipments`, `GET /logistics/shipments/:shipmentId/track` |
| `GET /messages/threads*` | `GET /conversations*` |
| `POST /payments/:id/refund` | `POST /payments/orders/:orderId/refund` |
| `PUT /products/:id` (also answers `PATCH`) | `PATCH /products/:id` |

## Changelog & status

- **v1.0** — initial GA surface (this document).
- Spec versioned in git; every PR that changes `openapi.yaml` must pass `oasdiff` breaking-change CI gate.
- Deprecations announced via `Deprecation:` + `Sunset:` headers, developer changelog, and email to API-key owners.
