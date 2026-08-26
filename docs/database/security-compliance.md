# WCO Database Security & Compliance

## 1. Identity & privilege model (migration 0002)

| Role | Purpose | Superuser | BYPASSRLS | DDL | DML |
|---|---|---|---|---|---|
| `wco_migrator` | CI migrations + ops pipeline | no | **yes** | yes | yes |
| `wco_app` | Application runtime | no | no | **no** | scoped by RLS |
| `wco_readonly` | BI / support tooling | no | no | no | SELECT only |

Hard rules:
* App connects ONLY as `wco_app` (DSN enforced in Helm values; startup check
  asserts `session_user`).
* Append-only surfaces (`audit_logs`, `outbox_events`) grant the app
  INSERT+SELECT — UPDATE/DELETE are structurally impossible.
* `statement_timeout=15s` (app) and `idle_in_transaction_session_timeout=30s`
  kill runaway work before it degrades the fleet.
* All roles pin `timezone='UTC'` — see README conventions.

## 2. Row-Level Security — defense in depth (ADR-003)

Application repositories scope every query by TenantContext; RLS is the second
line so a forgotten WHERE leaks zero rows instead of a competitor's catalog.

Session context per request (PgBouncer transaction pooling → must be
transaction-local):
```sql
BEGIN;
SET LOCAL app.current_store_id    = 'cku2…';
SET LOCAL app.current_merchant_id = 'cks8…';
…application statements…
COMMIT;
```

Policy catalog:

| Table(s) | Pattern | Policy logic |
|---|---|---|
| stores, categories, products, customers, orders, payments, deliveries, conversations, campaigns, automation_rules, price_suggestions, demand_forecasts, daily_store_metrics, analytics_events, webhook_subscriptions | A: direct storeId | `storeId = current_setting('app.current_store_id', true)` |
| messages, order_items, campaign_messages | B: nested | EXISTS parent join to tenant root |
| users, api_tokens, payment_methods, subscriptions, refresh_tokens | C: merchant | `merchantId = app.current_merchant_id` (refresh via user join) |
| ai_responses | hybrid | system templates (`storeId IS NULL`) readable by all; tenant rows writable only by owner |
| audit_logs | read-own | SELECT where storeId matches; INSERT granted; no update/delete grant at all |
| merchants | self | `id = current_merchant_id()` |

Unset GUC ⇒ `current_setting(..., true)` returns NULL ⇒ policy false ⇒ **fail
closed**. Platform jobs needing full reach run as `wco_migrator` (BYPASSRLS,
usage audited).

**Verification:** integration test suite runs two tenants against one schema
and asserts zero cross-reads with RLS enabled; runs in CI on every PR that
touches repositories or policies.

## 3. Encryption

| Layer | Control |
|---|---|
| In transit | TLS 1.2+ everywhere: Cloudflare→ALB, ALB→pods (mTLS via service mesh), pods→RDS `sslmode=verify-full` with RDS CA bundle |
| At rest (storage) | RDS encryption with customer-managed KMS key (+ automated rotation yearly); EBS/EFS/Elasticache/S3 same CMK family |
| At rest (fields) | AES-256-GCM application-layer envelope for PII columns — key from KMS, data keys cached ≤5min in memory |
| Backups | KMS-encrypted snapshots; cross-region copies under separate key (blast-radius isolation) |

Encrypted-field inventory: `payment_methods.accountNumberEnc`,
`delivery_providers.credentialsEncrypted`, `webhook_subscriptions.secret`
(HMAC material), WhatsApp provider tokens (merchants.settings, envelope).

Hash-not-encrypt where searchability is needed: token hashes
(`refresh_tokens.tokenHash`, `api_tokens.tokenHash`),
`payment_methods.accountNumberHash` (HMAC-SHA256 with server pepper).

## 4. PII inventory & handling

| Field | Class | Handling |
|---|---|---|
| customers.waPhone / name | PII-direct | E.164 CHECK, encrypted backups, DSAR-erasable, excluded from logs |
| payment_methods.* | PII-financial | ciphertext-at-rest + last4 display + HMAC dedupe; PCI scope kept at SAQ-A via PSP tokenization (we never touch card PANs) |
| orders.deliveryAddress | PII | retained per tax law; anonymized at merchant off-board |
| messages.body | PII-contextual | archived tokenized after 13mo; ES index holds 90d hot window only |
| audit_logs.actorIp | PII-weak | 12-month retention, then dropped by partition lifecycle |
| ai businessContext | Merchant IP | treated as confidential tenant data (RLS-scoped) |

Logging discipline (shared logger): denylist serializer strips
`waPhone|phone|email|address|token|password|authorization` fields recursively.
Violations fail the unit test suite via log-snapshot tests.

## 5. Compliance mapping

| Requirement | GDPR | NDPR | Implementation |
|---|---|---|---|
| Lawful basis & consent | Art.6 | §2 | `customers.marketingOptIn` explicit flag; campaigns filter on it; consent ledger events in analytics_events |
| Right of access/portability | Art.15/20 | §3(1)(7) | DSAR export bundle (JSON, signed URL) |
| Right to erasure | Art.17 | §3(1)(1) | dsar-erasure worker, 72h SLA, tombstone strategy |
| Data minimization | Art.5(1)(c) | §2(3) | retention matrix enforced by jobs, not vibes |
| Security of processing | Art.32 | §2(10) | this document + security-plan.md |
| Breach notification | Art.33 (72h) | §4 | incident runbook w/ regulator templates; audit_logs provide forensics timeline |
| DPO & records | Art.30 | §5 | RoPA generated from schema metadata (this doc set is machine-readable source) |

Cross-border transfers: primary region af-south-1; EU merchants (future)
served from eu-west-1 cell with EU-resident data — sharding design already
supports geo-cells.

## 6. Threat controls worth naming

* SQL injection: parameterized queries only; Prisma `$queryRaw` usage requires
  tagged-template form (`$queryRaw`...``) — lint rule bans string concatenation.
* Secrets: AWS Secrets Manager → ExternalSecrets → env; rotation playbook 90d;
  DB credentials rotate without downtime via dual-user swap.
* Insider risk: prod access via just-in-time IAM role (max 60min), all sessions
  recorded; direct psql requires break-glass approval which itself alerts.
* Webhook surface: HMAC-SHA256 signatures both directions (inbound provider,
  outbound merchant) with timestamp tolerance windows.
