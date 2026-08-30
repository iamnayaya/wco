# QA & Release Readiness

Everything needed to prove a release is safe: automated gates, defect
management, performance/security budgets, and the human review process.

## Where tests live

| Layer | Tooling | Location | Command |
|---|---|---|---|
| Backend unit | Jest + ts-jest | `apps/backend/tests/unit` | `yarn test:unit` (in `@wco/backend`) |
| Backend integration (hermetic) | Jest + supertest | `apps/backend/tests/integration` | `yarn test:integration` |
| Backend coverage gate | Jest thresholds (70/60/70/70) | `apps/backend/jest.config.cjs` | `yarn test:coverage` |
| Frontend unit | Vitest + RTL + jsdom | `apps/frontend/src/**/*.test.ts(x)` | `yarn test` (in `@wco/frontend`) |
| Frontend E2E | Playwright (chromium) | `apps/frontend/tests/e2e` | `yarn test:e2e` |
| Frontend accessibility | `@axe-core/playwright` (WCAG 2.1 AA) | `apps/frontend/tests/e2e/accessibility.spec.ts` | `yarn test:e2e` |
| Visual regression | Playwright + pixelmatch | `apps/frontend/tests/visual` | `yarn test:visual` |
| API performance | k6 | `infra/qa/k6` | `k6 run ...` |
| DAST | OWASP ZAP baseline | `infra/qa/zap` | `qa.yml → dast` |
| Dependency policy | Snyk | root | `qa.yml → snyk` |

## The QA gate (`.github/workflows/qa.yml`)

For every PR and push to `main`/`staging`:

1. **Coverage gate** — enforces the threshold budgets across backend + frontend.
2. **E2E** — full browser flows (auth, orders) against a mocked API.
3. **Accessibility** — axe scan of all key routes (critical/serious violations fail).
4. **Performance** — k6 budgets (p95 < 500ms, errors < 1%) enforced nightly.
5. **DAST** — ZAP baseline against a live target.
6. **Snyk** — dependency vulnerability/license policy.

`ci.yml` additionally runs lint, typecheck, secret scanning (gitleaks), SAST
(Semgrep), CodeQL, sharded unit tests, and Testcontainers-backed integration
tests before images are built.

## Severity & SLAs

| Severity | Definition | First response (business hr) | Fix target |
|---|---|---|---|
| **S1** | Outage, data loss, money loss, security incident | 15 min | 24 hr hotfix |
| **S2** | Major feature broken; workaround exists | 4 hr | 72 hr |
| **S3** | Minor bug; no impact blocker | 24 hr | next release |
| **S4** | Cosmetic / friction | 72 hr | backlog |

Severity is confirmed in triage (not by the reporter alone) and adjusted when
the blast radius changes.

## Triage ("Bug Mince")

- **Every** new `type/bug` issue starts `status/triage` (auto-labelled).
- **Daily**: QA lead (owner per CODEOWNERS `docs/qa/`) triages newest first —
  confirms severity, environment, reproducibility, adds `Priority: P1–P3`.
- **Weekly**: engineering huddle reviews P1/P2, unreproducible bugs, and any
  bug left untouched past its SLA.
- **Closing**: bugs close only with a linked fix/test, or a documented
  `won't fix` decision in the thread.

## Dashboards

- **Defect dashboard** — `type/bug` issues bucketed by severity/env/service;
  SLA exceeded flags from the `status/triage` → `in progress` → closed events.
- **Coverage trend** (Codecov) — per-package line/branch % and delta vs base.
- **Perf & SLO burn** — `infra/scripts/check-slo-burn.sh` alarms before
  budget breach; k6 CI results under `infra/qa/k6/`.
- **Incident links** — Sentry, Datadog, Grafana via the issue's `evidence`.

## When is a release "QA green"?

- `qa.yml` gate green (coverage, e2e, a11y, perf budget, DAST, Snyk).
- No open `Priority: P1` bugs on the affected surfaces for the change being
  promoted.
- Staging smoke tests passed on the promoted sha (see `ci.yml → deploy-dev`
  and `docs/qa/test-plan.md`).

See [`process.md`](./process.md) for the full defect lifecycle and
[`test-plan.md`](./test-plan.md) for the release test scope.