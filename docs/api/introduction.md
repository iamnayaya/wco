# API Introduction

> **Base URL (production):** `https://api.wco.africa/api/v1`
> **Dev / sandbox:** `https://dev.api.wco.africa/api/v1` (or `http://localhost:4000/api/v1` locally)
> **Interactive reference:** `http://localhost:4000/api/docs` (non-prod) · generated from [`openapi.yaml`](./openapi.yaml)

## What is the WCO API?

The WCO API lets you programmatically manage a **WhatsApp commerce store**: products, orders, customers, messages, payments, deliveries, analytics, and more. It's the same API the WCO dashboard and mobile app use, exposed publicly so merchants and partners can build custom tools, automations, and integrations on top of WCO.

## Why use the API?

| Use case | What it enables |
|---|---|
| **Inventory sync** | Keep your catalog in sync with other tools (ERP, spreadsheets) |
| **Order automation** | Create/confirm orders, send payment links automatically |
| **Customer sync** | Import/export customers, build custom CRM workflows |
| **Analytics pipelines** | Pull sales/customer/product data into your own reports |
| **Multi-channel** | Manage orders from WhatsApp + web + API in one place |
| **Custom checkout** | Embed WCO payments and logistics into your own storefront or bot |

## Everything you can do (module overview)

Through 16 modules and ~110 endpoints you can manage:

- **auth** — merchant registration, login, refresh, password, profile
- **users** — team/member management (OWNER/ADMIN)
- **stores** — multi-store CRUD, WhatsApp connect
- **customers** — CRM profiles, segments, tags, GDPR export/delete
- **products** — catalog CRUD, variants, stock, search
- **orders** — order lifecycle, items, stats
- **messages** — WhatsApp threads, send, bot takeover
- **payments** — links, verification, refunds, PSP webhooks
- **payment-methods** — merchant payout accounts
- **deliveries** — quotes, booking, tracking
- **subscriptions** — plans, subscribe, billing webhooks
- **ai-configs** — AI brain settings + response templates
- **analytics** — sales/customers/products/messages/dashboard
- **webhooks** — outbound subscription + test fire
- **whatsapp** — number connect/status/disconnect
- **platform** — health, status, metrics

## What makes the API production-grade

- **OpenAPI 3.1** spec, single source of truth ([`openapi.yaml`](./openapi.yaml)). A `oasdiff` CI gate rejects breaking changes.
- **Idempotency** on all unsafe POST/PUT via `X-Idempotency-Key` (24h replay window).
- **Store-scoped tenancy** via `X-Store-Id`, enforced server-side and in the database (RLS).
- **Cursor pagination** for stable results under writes.
- **Stable error codes** with a `requestId` for every failure — easy to debug.
- **Rate-limit tiers** with clear response headers.
- **Webhooks** (signed, HMAC) for events you care about.

## Supported operations & SDKs

Official SDKs and generated clients speed up integration:

| Language | SDK | Status |
|---|---|---|
| TypeScript | `wco-sdk` (npm) | ✔ Generated from spec |
| Python | `wco` (PyPI) | ✔ Generated from spec |
| Dart (mobile) | `wco_client` (pub.dev) | ✔ Generated from spec |
| Any (REST) | plain HTTP | Supported |
| GraphQL | `/api/v1/graphql` | Read aggregation |

See [SDKs & libraries](./sdk-libraries.md) and [Code examples, Postman & SDKs](./examples.md).

## Start building

1. **Authenticate** — get a JWT (login) or use a store-scoped API key. → [Authentication](./authentication-authorization.md)
2. **Pick your store** — set `X-Store-Id`. → [Authentication](./authentication-authorization.md#5-store-scoping-multi-store)
3. **Call your first endpoint** — try the [quickstart](./README.md#quickstart).
4. **Follow the conventions** — [Design guidelines](./design-guidelines.md) (naming, errors, pagination, versioning).

## API status & support

- **Status page:** https://status.wco.com
- **Changes & deprecations:** see [Changelog](../developer/13-changelog.md) and the deprecation policy in [Versioning](./design-guidelines.md#8-versioning--deprecation-policy).
- **Support for API partners:** api-support@wco.com

## Document map

| Document | Contents |
|---|---|
| [README](./README.md) | Quickstart, core contracts, endpoint surface |
| [Design guidelines](./design-guidelines.md) | REST rules, error catalog, pagination, idempotency, versioning, rate tiers |
| [Authentication & authorization](./authentication-authorization.md) | JWT, API keys, RBAC matrix, store scoping |
| [Security](./security.md) | OWASP alignment |
| this file (`introduction`) | What/why the API |
| [SDKs & libraries](./sdk-libraries.md) | Official SDKs & status |
| [Webhooks](./webhooks.md) | Outbound + inbound webhooks |
| [GraphQL](./graphql.md) | GraphQL endpoint & guidance |
| [Examples](./examples.md) | cURL / JS / Python + Postman collection |
| [openapi.yaml](./openapi.yaml) | **Complete OpenAPI 3.1 spec (source of truth)** |
