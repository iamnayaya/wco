# WCO Infrastructure & Platform

Production-grade infrastructure for WCO — a multi-tenant commerce platform
handling payments, logistics, AI, and webhooks at 1M+ user scale. Everything
below is **Infrastructure-as-Code**, declaratively managed, and auditable.

Primary region `af-south-1` (Cape Town) with DR in `eu-west-1` (Ireland).

---

## 1. Architecture at a glance

```
                          ┌──────────────────────────────┐
                          │          Users               │
                          │ browser · iOS · Android      │
                          └──────────────┬───────────────┘
                                         │ HTTPS
                          ┌──────────────▼───────────────┐
                          │  Amazon CloudFront (CDN) +   │
                          │  WAFv2 · TLS (ACM)           │
                          └──────┬───────────────┬───────┘
                                 │              │
                ┌────────────────▼─────┐   ┌────▼──────────────────┐
                │        frontend       │   │   AWS ALB (Ingress)  │
                │  app.wco.africa :3000 │   │   api.wco.africa     │
                └───────────────────────┘   └──────────┬───────────┘
                                                        │ L7 routing
          ┌───────────────┬──────────────┬──────────────┴────────────┐
          ▼               ▼              ▼                            ▼
   ┌──────────────┐ ┌────────────┐ ┌──────────────┐         ┌──────────────┐
   │   backend     │ │ webhook-   │ │   ai-engine  │         │ admin-       │
   │   :4000  API  │ │ handler    │ │   :5000      │         │ dashboard    │
   └──────┬───────┘ │            │ └──────┬───────┘         └──────┬───────┘
──────────┼─────────┼────────────┼───────┼─────────── EKS ─────────┼─────────
          │         │             │       │                         │
    ┌─────▼─────────▼─────────────▼───────▼─────────────────────────▼─────┐
    │         AWS Managed (cluster module)                                │
    │  RDS PostgreSQL (multi-AZ)   ElastiCache Redis   Amazon MQ RabbitMQ  │
    └───────────────┬──────────────────────────────────────────────────────┘
                    │ Sync (KMS-encrypted at rest, TLS in transit)
          ┌─────────▼──────────┐   ┌──────────────────────────────────┐
          │ S3 uploads/prompts │   │ GuardDuty · Security Hub ·        │
          │ (private, OAC)     │   │ Inspector2 · KMS · Budgets        │
          └────────────────────┘   └──────────────────────────────────┘
```

Pods on EKS assume **least-privilege AWS roles via IRSA** (OIDC) — no static
credentials on the cluster. Secrets live in AWS Secrets Manager and are
projected by the External Secrets Operator.

---

## 2. Repository layout

```
infra/
├── docker/                 # Dockerfiles + compose (dev & prod)
├── kubernetes/
│   ├── base/               # app manifests (kustomize, source of truth)
│   ├── overlays/           # dev / staging / prod differences
│   ├── monitoring/         # ServiceMonitor + PrometheusRules (kube-prometheus)
├── helm/wco/               # Helm chart (optional alternative path)
├── terraform/              # cloud platform (VPC, EKS, RDS, edge, security)
├── monitoring/             # Prometheus rules, Alertmanager, Datadog agent
├── logging/                # Fluent Bit + Loki
├── security/               # Pod Security (Kyverno/PSS), network policies
└── scripts/                # bootstrap / release-verification helpers
.github/workflows/          # ci · deploy-staging · deploy-production · terraform · mobile
```

---

## 3. Environments & namespaces

| Env    | K8s namespace | Hostnames                | Capacity            |
|--------|---------------|--------------------------|---------------------|
| dev    | `wco-dev`     | `dev.wco.com`           | smallest, 1 node    |
| staging| `wco-staging` | `staging.wco.africa`    | prod-shaped, small  |
| prod   | `wco-prod`    | `wco.africa`            | full multi-AZ + spot|

Observability/logging live in `wco-observability`. Production namespace runs
with guaranteed Pod Security Standard (`restricted`) enforced at admission.

---

## 4. Deployment flow

1. **CI** (`.github/workflows/ci.yml`) — lint, typecheck, SAST/secret scan,
   unit + integration tests, then builds & **cosign-signs** the 4 images.
2. **Dev** — auto-deployed from `main` via ArgoCD; smoke-tested.
3. **Staging** — `deploy-staging.yml` applies migrations, rolls out, wait +
   smoke test.
4. **Production** — `deploy-production.yml` requires a manual typed
   `RELEASE` confirmation, runs expand-phase DB migrations, then an
   **Argo Rollouts canary** (5% → 25% → 100%) with automatic SLO-driven
   rollback, and post-deploy synthetic-path verification.
5. **Infrastructure** — `.github/workflows/terraform.yml` plans on PR, applies
   to prod behind an environment approval with drift detection nightly.
6. **Mobile** — `.github/workflows/mobile.yml` typechecks, runs unit tests,
   then an EAS production build on `main`.

---

## 5. Disaster recovery (RTO/RPO)

| Failure | Detection | RTO | RPO | Runbook ref |
|---------|-----------|-----|-----|-------------|
| Pod/Node | Liveness/Readiness + node autoscaler | < 5 min | n/a | K8s self-heals |
| AZ loss  | ALB health + Multi-AZ spread | < 15 min | ≤ 5 min | `docs/runbooks/dr.md` |
| RDS primary | Multi-AZ failover (auto) | ~60 s | ~0 (sync) | `docs/runbooks/dr.md` |
| Region loss| Manual DR cutover (eu-west-1) | < 60 min | ≤ 15 min | `docs/runbooks/dr.md` |
| Data corruption | PITR + nightly snapshots | < 2 h | 24 h | `docs/runbooks/dr.md` |

**Backups:** RDS automated snapshots + `pg_dump` schedule, ElastiCache + MQ
snapshots, S3 versioning + cross-region replication.

---

## 6. Security posture

- **Identity:** IRSA pod roles, OIDC, short-lived tokens, no static keys.
- **Network:** private subnets, strict NetworkPolicies, WAFv2 + TLS1.3.
- **Data:** KMS-encrypted at rest everywhere; TLS in transit; secrets in
  SecretsManager (never in Git/image layers).
- **App:** SAST (Semgrep), secret scan (gitleaks), dependency audit, CodeQL,
  image signing + SBOM, Inspector2 vulnerability scanning.
- **Monitoring:** GuardDuty, Security Hub, audit log retention.
- See `docs/runbooks/security.md` and `infra/security/`.

---

## 7. Cost management

- Spot workers (60–70%) for stateless tiers, on-demand only where needed.
- CloudFront `PriceClass_100` (African + EU edges only).
- S3 lifecycle (STANDARD_IA after 30d, expire exports).
- Prod-only monthly budget ($50k) with 80%/100% alerts → SNS.
- One Loki replica + file retention; Datadog as paid alternative.
- See `docs/runbooks/cost.md`.

---

## 8. Compliance

- Encryption at rest/in transit, least-privilege, audit trail on every prod
  deploy, immutable signed images, PII handling documented.
- Map **NIST 800-53 / ISO 27001** controls to guardrails in
  `docs/runbooks/compliance.md`; Security Hub provides continuous evidence.

---

## 9. Operations & troubleshooting

- `/health`, `/health/live`, `/health/ready` probes on every service.
- Prometheus + Alertmanager (paging thresholds) + Grafana dashboards.
- Centralized logs in Loki (queryable from Grafana).
- Common remediations in `docs/runbooks/troubleshooting.md`.

---

## 10. Quick commands

```bash
# Local dev stack
docker compose -f infra/docker/docker-compose.yml up -d

# Prod-shaped local stack
docker compose -f infra/docker/docker-compose.prod.yml up -d

# Deploy base manifests with kustomize
kubectl apply -k infra/kubernetes/overlays/prod

# Infra
cd infra/terraform && ./bootstrap.sh && terraform init && terraform plan -var-file=envs/prod/terraform.tfvars
```

> **Running this repo for the first time?** See [`../docs/onboarding/README.md`](../docs/onboarding/README.md).
