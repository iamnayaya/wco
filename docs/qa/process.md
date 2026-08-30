# QA process & defect lifecycle

## Scope

Applies to all WCO services in this repo (backend, frontend, ai-engine,
webhook-handler, admin-dashboard, mobile, infra). QA evidence lives in code
(tests, workflows) — not in external tools alone.

## 1. Defect lifecycle

```
Report ─labeled status/triage (form: .github/ISSUE_TEMPLATE/bug_report.yml)
   │
   ├─ Daily triage (QA lead)
   │    ├─ Confirm severity (S1–S4)  →  add `Priority: P1–P3`
   │    ├─ Mark  Unreproducible  (label, ping reporter, 7-day auto-close)
   │    ├─ Mark  Duplicate      (link canonical, keep oldest one open)
   │    └─ Route: backend/frontend/… label + assign owner
   │
   ├─ Fix branch
   │    ├─ Tests first: add/CONTROL failing test reproducing the bug
   │    ├─ ci.yml + qa.yml must go green on the PR
   │    ├─ Reviewer confirms the regression test fails without the fix
   │    └─ Merge → deploy-dev/staging automation
   │
   ├─ Close path (QA lead)
   │    ├─ fix merged + linked, or
   │    └─ documented `won't fix` (with risk decision in thread)
   │
   └─ Post-close
        ├─ Add a regression test to the permanent suite if not already there
        └─ Tag issue with the coverage/e2e test that guards the path
```

## 2. Severity confirmation

A reporter's initial severity is a **suggestion**. Triage confirms:

- **S1** only after verifying money/data/security impact with the on-call or
  security owner; S1s automatically page (`qa.yml` → incident route) and get a
  `hotfix` priority branch.
- **S1/S2 bugs are blocked from shipping a release** that touches the affected
  surface. `Priority: P1` never rides a release.
- Downgrades must be commented with a reason and agreed in the weekly huddle.

## 3. Escalation

| Signal | Where | Action |
|---|---|---|
| SLO burn alerts | `infra/scripts/check-slo-burn.sh` | Open S1, page on-call |
| Coverage regresses below gate | Codecov + `qa.yml` coverage job | Fix coverage or add tests before merge |
| k6 budget breach | nightly `qa.yml → performance` | Open perf bug; repeat until green |
| ZAP high finding | `qa.yml → dast` | Security review; fix or risk-accept in doc |
| Snyk policy violation | `qa.yml → snyk` | Upgrade/fork dependency, or documented decision |

## 4. Release promotion checklist

Pre-merge for every promotion (dev → staging → prod):

- [ ] `ci.yml` green: lint, typecheck, secret scan, SAST, unit (sharded), integration.
- [ ] `qa.yml` green: coverage, e2e, a11y, DAST, Snyk (perf enforced nightly).
- [ ] Visual regression within tolerance (`test:visual`) for touched routes.
- [ ] No open P1 on affected surfaces.
- [ ] DB migrations applied in the target env (staging automation does this).
- [ ] Post-deploy smoke passed (`infra/scripts/post-deploy-checks.sh`).
- [ ] Runbook available for ops (see `docs/runbooks/`).

## 5. Ownership

- QA lead templates/test ownership: `docs/qa/` in `.github/CODEOWNERS`.
- Defect triage rotates weekly; naming and hand-off recorded via GitHub project
  board (dashboards in [`README.md`](./README.md)).

## 6. Metrics the weekly huddle tracks

- Open bugs by severity & age (SLA exceed count).
- Reopen rate (bugs closed and reopened within 30 days).
- Test debt: files under the coverage gate that needed threshold relief.
- Nightly gate health: e2e / perf / dast flake rate.