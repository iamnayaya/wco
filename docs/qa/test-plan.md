# Release test plan

Scope of verification for each release. "Automated" refers to the permanent
suites wired into `ci.yml` / `qa.yml`; "manual" is the staging smoke pass.

## Critical user journeys

| # | Journey | Automated coverage | Manual smoke (staging) |
|---|---------|--------------------|------------------------|
| J1 | Register merchant → OWNER account | `auth-flow.integration.spec.ts`, `use-auth.test.ts`, `register` page | Create account, verify email |
| J2 | Login (password), 2FA challenge, refresh rotation | `auth-v2.integration.spec.ts`, `login page.test.tsx`, `auth.spec.ts` (e2e) | Login with/without 2FA |
| J3 | Catalog: CRUD, variants, inventory, import/export | `products-v2.integration.spec.ts`, `product-rules.spec.ts`, `menu` | Create product, import CSV |
| J4 | Orders: list, create, status, refunds, fraud/AI | `orders-v2.integration.spec.ts`, `order-rules.spec.ts`, `orders.spec.ts` (e2e) | Create order via WhatsApp phone |
| J5 | Payments: Paystack/FCM, webhook signature, refunds | `payments-v2.integration.spec.ts`, `payment-webhook-signature.spec.ts` | Sandbox payment, webhook event |
| J6 | Messaging: conversations, templates, campaigns | `messages-v2.integration.spec.ts`, `message-rules.spec.ts` | Reply from inbox |
| J7 | Customers & segments | `customers-v2.integration.spec.ts`, `segment-rules.spec.ts` | Add customer, segment |
| J8 | Analytics dashboard & AI insights | `analytics-*.service.spec.ts`, `use-dashboard` vitests | Dashboard renders metrics |
| J9 | Delivery zones/costs & logistics | `delivery-*.service.spec.ts` + DTO spec | Rate calculation |
| J10 | Admin: RBAC scoping, user mgmt, subscriptions | `rbac-scoping.integration.spec.ts`, `rbac.spec.ts` | Owner vs cashier permissions |
| J11 | Resilience: Health, startup probes, secret lifecycle | `health.integration.spec.ts`, `api.smoke.e2e.spec.ts` | `/health`, `/health/ready` |
| J12 | Accessibility of all key screens (WCAG 2.1 AA) | `accessibility.spec.ts` (axe) | Screen-reader spot check |
| J13 | Visual consistency (no unintended drift) | `test:visual` (pixelmatch) | Eyeball diff vs baseline |
| J14 | Performance budgets | `infra/qa/k6/*.js` | Latency p95 < 500ms on staging |

## What must be green to promote

1. `ci.yml` (lint/typecheck/security/sharded unit/integration).
2. `qa.yml` (coverage gate, e2e, a11y, DAST, Snyk; perf on nightly cadence).
3. No P1 open on affected surfaces.
4. Manual smoke checklist (staging) below.

## Manual smoke checklist (staging) — ~20 min

Run after a successful `deploy-staging.yml` rollout:

- [ ] `curl https://api.staging.wco.africa/health` → `{"status":"ok"}`
- [ ] `curl https://api.staging.wco.africa/health/ready` → ready=1
- [ ] Sign in as the QA OWNER (see `infra/qa/seed` credentials in Vault)
- [ ] Dashboard metrics + chart render; refresh keeps session
- [ ] Create an order from a seeded customer, confirm status transitions
- [ ] Look up customer by phone; open a conversation; send a template
- [ ] Create product with variant; adjust inventory; re-import the sample CSV
- [ ] Trigger a refund on the sandbox order; confirm timeline entry
- [ ] Enable 2FA; log out; log in via 2FA; use one backup code
- [ ] Search orders by order number; filter by status + channel
- [ ] Open Orders → run axe a11y scan (should pass on staged build)

## Defect-to-test feedback loop

Every closed bug must point at the regression test that guards it. If no test
covers the path, the QA lead files a follow-up `type/test` issue before the bug
closes (see [`process.md`](./process.md)).

## Release artifact

Each promoted sha is tagged with the QA evidence: CI run id, k6 summary,
ZAP report link, coverage snapshot — recorded in the release description so an
auditor can reproduce the "QA green" decision.