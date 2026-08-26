# Onboarding Guide — your first week on WCO

## Day 1: environment

```bash
git clone <repo> wco && cd wco
./infra/scripts/bootstrap.sh        # installs, boots infra, migrates, seeds
cp .env.example .env                # then fill in what you have
npm run dev                         # turbo runs backend + frontend + ai-engine
```

Verify:

- API health: `curl localhost:4000/health` → `{"status":"ok", ...}`
- Web app: http://localhost:3000 (login: seed merchant credentials in `packages/database/prisma/seed.ts`)
- RabbitMQ UI: http://localhost:15672 (wco / from docker-compose)

## Day 2: architecture in 30 minutes

Read, in order:

1. `docs/architecture/system-architecture.md` — the big picture + Mermaid diagrams
2. `docs/architecture/data-flow.md` — how a WhatsApp message becomes money
3. `docs/adr/` — why it's built this way (outbox, tenancy, monorepo)

Then trace **one real flow end-to-end**: inbound message → webhook-handler → queue → AI reply. Set breakpoints or add temp logs; the code is small enough to hold in your head.

## Day 3: conventions that will get your PR approved

- **Tenancy:** every query touching tenant data must scope by `storeId` from `TenantContext`. No exceptions.
- **Money:** `Prisma.Decimal` in DB; convert at the edges only.
- **Events:** state changes emit outbox rows, not direct publishes (see ADR-002).
- **Validation:** DTOs with class-validator on every endpoint; whitelist mode strips unknown fields.
- **Errors:** throw Nest built-ins (`NotFoundException`, …); never return `{ error }` manually.

## Day 4: ship something small

Good first tasks: a new analytics field, an inbox filter, a webhook event type. The loop:

```bash
npm run dev --workspace=@wco/backend
npm run test --workspace=@wco/backend
npm run lint && npm run typecheck
```

Commit style: conventional commits (`feat(orders): ...`) — enforced by commitlint + husky.

## Day 5: production shape

- Deploys: GitHub Actions → ECR/EKS via ArgoCD (`infra/kubernetes`, overlays per env)
- Secrets: AWS Secrets Manager → External Secrets Operator; nothing secret in Git, ever
- Dashboards: Grafana (infra/prometheus rules) + PagerDuty for SEV1
- On-call: rotate documented in Notion; runbook links live in each alert annotation

## Who to ask

| Area | Where to look first |
|---|---|
| Backend/API | `apps/backend/src/modules/<module>` + module README if present |
| AI engine | `apps/ai-engine/src/{services,modules}` |
| Webhooks/PSPs | `apps/webhook-handler/src/modules` |
| Infra | `infra/kubernetes`, run `kubectl get events -n wco-dev` before asking |
