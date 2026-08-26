# API Security

> OWASP API Security Top-10 (2023) alignment, control by control.
> Owners: security chapter reviews every change to guards, filters, CORS, validation.

---

## 1. OWASP API Top-10 coverage map

| # | Risk | Primary controls |
|---|---|---|
| API1 | BOLA / IDOR | TenantGuard store membership; every query scoped by `storeId` from TenantContext (never from client body); RLS as backstop; 404 for foreign ids (no enumeration) |
| API2 | Broken authentication | RS256 JWT w/ short TTL; single-use rotating refresh + family revocation; argon2id passwords; per-email+IP throttle; API keys hashed, prefix-visible |
| API3 | Object property level authorization | DTO whitelist (`forbidNonWhitelisted`), response field ACLs (e.g., payment-methods never return ciphertext; users never return passwordHash) |
| API4 | Unrestricted resource consumption | rate tiers, body caps, pagination caps, expand depth ≤ 1, AI test budget, GraphQL complexity cost |
| API5 | Broken function level authorization | @Roles decorators + capability matrix; deny-by-default on new routes (lint rule requires explicit roles) |
| API6 | Business flows abuse | idempotency keys, order state machine, refund ≤ paid amount, campaign audience = opt-in only, WhatsApp number global uniqueness |
| API7 | SSRF | outbound calls only to allow-listed provider domains; merchant-supplied webhook URLs validated: https-only, DNS-pinned private ranges blocked |
| API8 | Misconfiguration | helmet defaults, prod CSP, no stack traces, CORS allow-list, gateway is only ingress, debug endpoints internal-only |
| API9 | Improper inventory | openapi.yaml is generated from code and diffed in CI; deprecated routes tracked with Sunset dates |
| API10 | Unsafe consumption of third-party APIs | provider payloads schema-validated on ingest; signature verification constant-time; raw bodies persisted before processing |

## 2. Transport & headers

TLS 1.3 at CDN/gateway; HSTS preload (`max-age=63072000; includeSubDomains; preload`).
helmet sets (prod): CSP default-deny for API responses, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, no `X-Powered-By`, 10 MB body cap
(1 MB webhooks, 32 KB auth).

## 3. CORS

Allow-list only — never reflect Origin:

```ts
origin: ['https://app.wco.africa', 'https://admin.wco.africa']   // + localhost in dev
credentials: true
allowedHeaders: [Content-Type, Authorization, X-Request-ID, X-Idempotency-Key, X-Store-Id, If-Match]
maxAge: 86400
```

Native mobile and server-to-server clients are not browser-bound: CORS is irrelevant
to them, and preflight failures cannot be "fixed" by loosening the list.

## 4. CSRF strategy

The API is cookie-independent **except** the dashboard refresh flow, which uses a
httpOnly `SameSite=Lax` cookie scoped to the API domain:

- All state-changing requests additionally require the `Authorization` header (not
  sent automatically cross-site) or an `X-Requested-With: XMLHttpRequest` header —
  both CSRF-proof because attackers cannot set custom headers cross-origin.
- SameSite=Lax blocks cross-site POST cookie attachment as second layer.
- No JWT-in-cookie for access tokens → no classic token-CSRF surface.

## 5. Input validation

Layered, fail-loud:

```text
L1  Transport    JSON parse errors → 400; size caps at gateway
L2  Shape        class-validator DTO whitelist; forbidNonWhitelisted → 422
L3  Semantics    enums, E.164 regex, currency ISO list, money string regex ^\d+(\.\d{1,2})?$
L4  Business     state machines, stock checks, tenant FK existence inside transaction
```

All error paths return the standard envelope with per-field `details.errors[]`.
Query params are equally whitelisted (unknown filter keys rejected — see guidelines §6).
File uploads (product images) go direct-to-S3 via presigned URLs; the API accepts
only S3 keys, never streams user files.

## 6. SQL injection prevention

- Prisma parameterizes everything by default; string interpolation into `$queryRaw`
  is banned — enforced by ESLint rule + CODEOWNERS gate on repository files.
- Dynamic sorting/filtering maps through fixed column dictionaries:
  `const SORTABLE = { createdAt: 'createdAt', name: 'name' } as const` — identifiers
  never concatenate client input.
- RLS policies add a hard wall: even a hypothetical injection runs as `wco_app`
  with `app.current_store_id` pinned; cross-store reads return zero rows.

## 7. XSS prevention

API returns `application/json` only — no HTML rendering server-side. Defense happens
at consumers, but we still:

- sanitize message/template bodies stored from merchants (strip `<script>` event handlers)
  with a conservative allow-list since bodies re-render in dashboard chat bubbles;
- serve all uploads from a separate media domain (`media.wco.africa`) so stored files
  can never execute against app origin cookies;
- enforce CSP on dashboard/web apps (separate docs).

## 8. Webhook security (both directions)

Inbound (providers → WCO): HMAC verification over **raw bytes** before parsing,
constant-time compare, ±5 min timestamp tolerance where provided, replay dedupe on
provider event ids, payload persisted before ack. Outbound (WCO → merchants):
signed `t,v1` scheme, HTTPS-only targets, retries with backoff, auto-disable after
30 consecutive failures. Details: [webhooks.md](./webhooks.md).

## 9. Secrets handling

| Secret | Where it lives | Never |
|---|---|---|
| JWT RSA private key | KMS/Secret Manager, mounted read-only | in repo, logs, tokens |
| PSP/logistics credentials | encrypted columns (AES-256-GCM envelope) or vault | plaintext DB |
| payout account numbers | app-layer AES-256-GCM + HMAC hash for lookup | returned by API (last4 only) |
| API keys / whsec_ | shown once at creation; SHA-256 stored | logged (redaction filter on `key|secret|token` fields) |

Log redaction is centralized in pino serializer — any field matching
`(password|token|secret|apiKey|authorization|accountNumber)` masks to `***`.

## 10. Abuse & anomaly detection

- Per-principal rate tiers (guidelines §12) + global edge ceilings.
- Velocity rules: >5 failed logins/15min/email → temporary lockout email;
  refund attempts >3/hour/store → manual review queue;
  webhook endpoint failing 30× consecutively → auto-disable + owner notice.
- Security events land in `audit_logs` with actor/ip/action and feed the SIEM alert pack.

## 11. Dependency & pipeline security

- Lockfile-enforced installs; Renovate weekly; `npm audit --audit-level=high` blocks CI.
- Container images distroless, non-root, read-only rootfs; SBOM attached to releases.
- Annual pen-test scope includes this API surface; findings tracked to closure.

## 12. Reporting

security@wco.africa with coordinated disclosure policy; triage SLA 24 h for
reproducible authz bypasses. Hall-of-fame published with reporter consent.
