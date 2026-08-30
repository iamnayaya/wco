# Changelog

> The authoritative changelog lives in the repository (`CHANGELOG.md`, generated from conventional commits). This page explains **how** the changelog works and summarizes recent highlights.

## Versioning

WCO follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **MAJOR** — breaking API/behavior changes.
- **MINOR** — backward-compatible features.
- **PATCH** — backward-compatible bug fixes.

The **API** additionally versions its public surface as `/api/v1`, `/api/v2`, etc. (see [API: Versioning](../api/design-guidelines.md#8-versioning--deprecation-policy)). API changes follow the same semver rules within the current `v1` (additive only).

## How the changelog is generated

Commits follow [Conventional Commits](./06-git-workflow.md#commit-conventions-conventional-commits). On each release, the changelog is generated via **Changesets** for packages and a tool-based aggregation for apps:

- `feat:` → added under **Added**
- `fix:` → added under **Fixed**
- `feat(api)!:` (breaking) → added under **Changed/Breaking**
- `security:` → added under **Security**
- `deprecate:` → added under **Deprecated**

## Release cadence

- **Apps (web/mobile/backend/ai):** continuous deployment — app version = git SHA + timestamp (`2026.08.21-a1b2c3d`).
- **Packages:** Changesets version PRs, consumed semantically.
- **Mobile:** biweekly release train to TestFlight / Play internal → staged rollout 10% → 50% → 100% with crash-rate gates.

## Current version & highlights

### v1.0.0 — Initial GA (recent)

**Added**
- Merchant dashboard with orders, products, customers, messages, analytics, settings.
- Public merchant API (`/api/v1`, OpenAPI 3.1, ~110 endpoints across 16 modules).
- AI auto-responder (Claude/OpenAI) for WhatsApp inquiries (~5s replies).
- Payment integrations: Paystack, Flutterwave, OPay.
- Logistics integrations: GIG, Kwik, Sendy.
- Customer CRM with segments, tags, and GDPR export/delete.
- AI pricing optimizer and marketing automation foundations.
- Mobile app (React Native) for iOS and Android.
- Multi-tenant store isolation with Postgres RLS.
- Comprehensive monitoring, logging, and tracing (Prometheus/Grafana, ELK, OpenTelemetry).
- Full QA pipeline: unit, integration, E2E, a11y, visual, performance (k6), security (SAST/DAST).

**Security**
- JWT refresh-token rotation, store-scoped API keys, RBAC.
- AES-256 at rest, TLS 1.3 in transit.
- Webhook HMAC signing + replay protection.

## Latest patch / hotfix conventions

- Hotfix branches (`hotfix/*`) cut from `main`, squash-merged, tagged `vX.Y.Z+hotfix`.
- Every production fix must include a test regression and a changelog entry.

## Where to contribute

- To record a new change, just write a conventional commit; the tooling does the rest.
- Hand-written, user-facing "What's new" release notes are drafted in the [Release process](../CONTRIBUTING.md#release-process) section and posted to the changelog + status page.
