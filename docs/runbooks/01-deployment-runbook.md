# Runbook: Deployment

Deploys to dev/staging/prod, verification, and rollback.

## Scope
Normal deploys are **automated** (GitHub Actions → ECR → ArgoCD → Argo Rollouts). This runbook covers the automated path plus the manual steps operators use for verification, troubleshooting, and rollback.

## Prerequisites
- Access to the repo and the target cluster (`kubectl` configured for the env).
- `ArgoCD` CLI (`argocd`) and `helm` installed.
- Change-window approval for production (Prod gate) if required.

## Environments

| Env | Source branch | Deploy method | URL |
|---|---|---|---|
| dev | `develop` / `main` merge | ArgoCD auto-sync + smoke | dev.wco.com |
| staging | `release/*` | ArgoCD + E2E + load smoke | staging.wco.com |
| prod | `main` (gated) | Argo Rollouts canary | app.wco.com |

## Steps

### 1. Verify the gate is green
- CI + QA (`ci.yml`, `qa.yml`) green for the target sha.
- No open P1 bugs on the affected surfaces (`docs/qa/README.md`).
- Migrations reviewed and tested up **and** down.

### 2. Deploy dev (automatic)
```bash
# After merge to main/develop, ArgoCD syncs dev automatically.
# Confirm sync status:
argocd app get wco-dev
```
Expected: all apps `Synced` + `Healthy`; smoke tests pass.

### 3. Promote staging
```bash
# Trigger the release-train job, or manually:
argocd app sync wco-staging
# Then E2E suite + k6 load smoke run automatically (qa.yml).
```

### 4. Deploy production (gated canary)
```bash
# Prod uses Argo Rollouts (5% → 25% → 100%; 10-min analysis windows).
argocd app sync wco-prod
```
Wait for the rollout to progress. Automatic rollback triggers on SLO burn > 2x during analysis.

### 5. Post-deploy verification
```bash
# Health & liveness
curl -fsS https://api.wco.africa/health

# Rollout status
kubectl -n wco-prod get rollouts -w

# Check error rate / latency drop (Grafana/Datadog) over the next 10-15 min
```

Mark the release `Done` in the ops log / status page notes.

## Database migrations (expand-migrate-contract)
- Migration job runs **before** new pods receive traffic.
- Only backward-compatible (additive) migrations in this release; breaking changes span two releases.
- If a migration needs manual intervention → [Database runbook](./08-database-runbook.md) migrations section.

## Rollback
> Rollback is only for behavioral regressions; **do not** roll back schema with data migration and code simultaneously.

```bash
# Argo Rollouts: undo to previous stable
kubectl -n wco-prod rollout undo rollout/<app>   # or
argocd app rollback wco-prod <revision>

# Helm-based: helm rollback
helm rollback <release> <revision> -n wco-prod
```
After rollback, re-verify health + error rate. Log the reason in the incident/ops record.

## Escalation
- If deploy fails reproducibility / hangs > 20 min: page the platform team (`#platform-eng` + PagerDuty).
- If users are affected: declare incident → [Incident response runbook](./03-incident-response-runbook.md).
