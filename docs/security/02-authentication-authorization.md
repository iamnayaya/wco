# Authentication & Authorization

How WCO authenticates principals and authorizes actions, plus best practices for integrators.

## Overview

```mermaid
sequenceDiagram
    participant C as Client
    participant B as Backend
    participant R as Redis
    C->>B: login (credentials)
    B-->>C: accessToken (JWT, 15m) + refreshToken (opaque, 7d, single-use)
    C->>B: GET /orders with Bearer + X-Store-Id
    B->>B: verify JWT + RBAC + tenant (TenantContext)
    B-->>C: 200 data
    Note over C,B: refresh rotates (old token invalid; reuse revokes family)
```

## Authentication (AuthN)

| Method | Use | Details |
|---|---|---|
| **JWT access token** | API calls | Short-lived (15m); signed; carries user + role |
| **Refresh token** | Renew access | 7-day; **single-use rotation**; reuse kills the whole session family |
| **API keys** | Server-to-server (M2M) | Store-scoped (`X-API-Key`), shown once at creation |
| **2FA** | Optional login hardening | Authenticator / recovery codes |
| **SSO (staff)** | Internal | Okta/Azure AD with MFA; break-glass audited |

Guarantees:
- Expired/revoked tokens are rejected (`401 UNAUTHORIZED`).
- Login & reset endpoints are rate-limited to deter brute force ([API: Rate limiting](../api/design-guidelines.md#12-rate-limit-tiers)).
- Passwords stored as strong hashes (bcrypt rounds per config); never plaintext.

## Authorization (AuthZ)

Role-based access control (RBAC) with **permission strings** per route:

| Role | Scope | Example capabilities |
|---|---|---|
| **OWNER** | Full store | settings, payments, payouts, API keys, team |
| **ADMIN** | Manage store | products/orders/customers/messages + team (no payouts by default) |
| **AGENT** | Operate | orders, customers, messages, fulfillment |
| **VIEWER** | Read-only | analytics, read views |

Authorization is enforced server-side per request — the client never decides what's allowed. A missing permission → `403 FORBIDDEN`.

## Tenancy (multi-store isolation)

- Every business resource is scoped to a **store**.
- The active store is chosen via `X-Store-Id` (API) or the session (dashboard).
- The `TenantContext` guard attaches the store to the request.
- **PostgreSQL RLS** is the database backstop — even a stolen direct-DB connection can't cross tenants.
- Wrong/foreign store → `403 TENANT_MISMATCH` / `404 NOT_FOUND` (no existence leak).

## Best practices for integrators
1. **Keep tokens short-lived;** implement refresh-token rotation on the client.
2. **Send `X-Store-Id`** when you manage multi-store accounts.
3. **Prefer API keys for automation** over storing user JWTs.
4. **Never expose** tokens, secrets, or full card data in client code or logs.
5. **Store tokens securely** (env/secret manager, secure storage) — treat like credentials.
6. **Validate webhook signatures** (HMAC) and check timestamps — see [Webhooks](../api/webhooks.md).

## Related
- Full API auth guide: [Authentication & authorization (API)](../api/authentication-authorization.md)
- RBAC matrix & credential lifecycle: `docs/api/authentication-authorization.md`
- Generic security: [Security overview](./01-security-overview.md)
