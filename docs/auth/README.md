# WCO Authentication & Authorization Architecture

Status: implemented in `apps/backend/src` — this document is the map.

## 1. System overview

```
                        ┌──────────────────────────────────────────────┐
Client (SPA / mobile)   │                  API (Express)               │
        │               │                                              │
        │ Bearer JWT ──▶│ helmet/cors → rate-limit → authenticate()    │
        │               │                    │                         │
        │ refresh ─────▶│            ┌───────┴────────┐                │
        │               │            │ token.service  │                │
        ▼               │            │  · verify JWT  │                │
  /auth/refresh         │            │  · jti denylist│──▶ Redis       │
  (rotate, single-use)  │            └───────┬────────┘                │
                        │                    ▼                         │
                        │             rbac.requirePermission           │
                        │                    ▼                         │
                        │             tenantScope (X-Store-Id)         │
                        │                    ▼                         │
                        │              services → Prisma               │
                        └──────────────────────────────────────────────┘
```

Two credential types share one `Authorization: Bearer` header:

| Credential | Format | Lifetime | Revocation |
|---|---|---|---|
| Access token | JWT HS256 (`sub`, `merchantId`, `role`, `jti`) | 15 min | Redis denylist on `auth:jti:{jti}` until natural expiry |
| Refresh/session | 384-bit opaque random, stored **hashed** | 7 days | DB row `revokedAt`; rotation on every use |
| Machine token | `wco_…` public API token | until revoked | `api_tokens.revokedAt` |

## 2. Session lifecycle

- **signup/register** creates Merchant + OWNER user atomically; first session issued immediately.
- **login** accepts `identifier` (email **or** phone). Pipeline:
  1. lockout check (Redis `wco:auth:lock:{userId}`) → 403 with `retryAfterSeconds`
  2. bcrypt compare vs real hash or a fixed decoy hash for unknown users (constant-ish work, no enumeration)
  3. failure → `INCR wco:auth:fail:{userId}`; at threshold (5) the account locks for 15 min and an email is queued
  4. success clears the fail counter
  5. optional gate: `REQUIRE_VERIFIED_LOGIN` blocks unverified accounts
  6. if TOTP confirmed → respond `{ twoFactorRequired, challengeId }` (Redis, single-use, 5 min); tokens only after `/auth/2fa/login`
- **refresh** is *rotation with reuse detection*: presenting a consumed/revoked refresh token revokes every session of the user (theft signal) and warns.
- **logout** revokes the refresh row **and denylists the presented access token's `jti`**, so a stolen access token dies immediately instead of living out its window.
- **Sessions API**: `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/sessions/revoke-all` (keeps the caller's current session via its refresh-token hash).

## 3. Credential recovery & verification

All one-time credentials are stored as SHA-256 hashes with expiry + `consumedAt` (single-use claim is an atomic conditional `updateMany … where consumedAt: null`):

| Flow | Table | TTL | Notes |
|---|---|---|---|
| Password reset | `password_resets` | 15 min | confirm rotates password + revokes all sessions; resends invalidate prior links |
| Email verification | `email_verifications` | 24 h | request/resend authenticated; confirm is public `{token}` |
| Phone verification | `phone_verifications` | 10 min | 6-digit code, max 5 attempts per code, delivered via SMS provider |

Request endpoints always answer success even for unknown emails — no enumeration.

## 4. Two-factor authentication (TOTP, RFC 6238)

Implemented from `node:crypto` — no third-party OTP dependency:

- 160-bit secrets, base32 (RFC 4648), 6 digits, SHA-1 HMAC, 30 s step, ±1 step drift.
- Enrollment: `POST /auth/2fa/setup` → `otpauth://` URI (Google Authenticator/Authy/1Password) → `POST /auth/2fa/enable {code}` verifies once, stores `confirmedAt`, returns **10 backup codes shown exactly once**.
- At rest the shared secret is sealed AES-256-GCM under `AUTH_SECRET` (`two_factor_secrets.secret_enc`).
- Login challenge accepts TOTP **or** a backup code; a used backup code burns (hashes live in `backup_codes` JSON).
- Disable requires the account password (`POST /auth/2fa/disable`).

## 5. Social login (OAuth2 authorization code)

Hand-rolled on `fetch` — Google, Facebook, Apple:

1. `GET /auth/:provider/start` → consent URL + one-time CSRF `state` (Redis, 10 min). Unconfigured providers → 503; `GET /auth/providers` reports availability.
2. Callback exchanges `code` server-side:
   - Google: OIDC userinfo (`sub`, email)
   - Facebook: graph `/me?fields=id,name,email`
   - Apple: ES256 client-secret JWT minted per request; `id_token` claims validated (iss/aud/exp)
3. Account resolution: link by `(provider, providerAccountId)` → else link by email → else provision merchant + OWNER (email marked verified because the provider asserted ownership).
4. State is `GETDEL`-consumed before any exchange — forged/replayed states fail closed.

## 6. Authorization

- **authenticate()** — resolves both credential types; checks the jti denylist.
- **RBAC matrix** (`src/middleware/rbac.ts`) — roles OWNER > ADMIN > MANAGER > AGENT > VIEWER; `requirePermission('orders','write')` etc. Guards are proper Express `RequestHandler`s.
- **tenantScope()** — resolves/validates `X-Store-Id` against the merchant and publishes tenant info through AsyncLocalStorage so every query stays scoped.

## 7. Platform defenses

| Control | Where |
|---|---|
| Rate limiting | global window + hard per-route limit on all credential endpoints (`RateLimit-*` headers) |
| Account lockout | Redis counters, 5 fails / 15 min, notification email |
| Security headers | helmet (CSP off in dev, HSTS in prod), strict CORS allow-list |
| Audit trail | `audit_logs` via audit service on privileged actions |
| Password policy | min 8 chars incl. upper/lower/digit; bcrypt cost from env (12 ≈ 250 ms) |
| Input validation | Zod schemas on every route body/query/params |

## 8. Data model additions (Prompt 5)

`User`: `phone`, `emailVerifiedAt`, `phoneVerifiedAt`, `lockedUntil`, `failedLogins`.
`RefreshToken`: `lastUsedAt` (touched on rotation).
New tables: `password_resets`, `email_verifications`, `phone_verifications`, `two_factor_secrets`, `oauth_accounts` (unique `(provider, providerAccountId)`).

## 9. Environment

| Var | Purpose |
|---|---|
| `AUTH_SECRET` | 32-byte base64 key sealing TOTP secrets + HMAC-ing backup codes (**required in prod**) |
| `REQUIRE_VERIFIED_LOGIN` | block logins until email/phone verified (default false — informal traders onboard offline-first) |
| `ACCOUNT_LOCKOUT_THRESHOLD` / `_SECONDS` | brute-force tuning (5 / 900) |
| `GOOGLE_*`, `FACEBOOK_*`, `APPLE_*`, `OAUTH_REDIRECT_BASE_URL` | OAuth; unset ⇒ endpoint 503s gracefully |
