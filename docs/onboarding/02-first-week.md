# Onboarding — Your First Week

A day-by-day path to become productive in your first week. The original quick-start lives in the existing [onboarding README](./README.md); this version adds the polish and links.

## Day 1 — Environment & access

```bash
git clone <repo> wco && cd wco
./infra/scripts/bootstrap.sh        # installs, boots infra, migrates, seeds
cp .env.example .env                # fill in what you have
npm run dev                         # turbo runs backend + frontend + ai-engine
```

**Verify:**
- API health: `curl localhost:4000/health` → `{"status":"ok"}`.
- Web app: http://localhost:3000 (login with seed merchant credentials in `packages/database/prisma/seed.ts`).
- RabbitMQ UI: http://localhost:15672 (wco / from docker-compose).

**Also today:** request access (GitHub, Slack, cloud read-only, Sentry/Grafana). Ask your buddy if anything is missing.

## Day 2 — Architecture in 30 minutes

Read, in order:
1. [Architecture overview](../developer/02-architecture-overview.md) — the big picture.
2. [Data flow](../architecture/data-flow.md) — how a WhatsApp message becomes money.
3. [ADRs](../adr/) — why it's built this way (outbox, tenancy, monorepo).

Then trace **one real flow end-to-end** (inbound message → webhook-handler → queue → AI reply) with breakpoints or temp logs.

## Day 3 — Conventions that get your PR approved

- **Tenancy:** every query touching tenant data scopes by `storeId` from `TenantContext`. No exceptions ([ADR-003](../adr/ADR-003-multi-tenancy.md)).
- **Money:** `Prisma.Decimal` in DB; convert at the edges only.
- **Events:** state changes emit outbox rows, not direct publishes ([ADR-002](../adr/ADR-002-transactional-outbox.md)).
- **Validation:** DTOs with class-validator on every endpoint; whitelist mode strips unknown fields.
- **Errors:** throw Nest built-ins; never return `{ error }` manually.
- **Commits:** conventional commits (`feat(orders): ...`) — enforced by commitlint + husky.

Read fully: [Code style guide](../developer/05-code-style-guide.md) and [Git workflow](../developer/06-git-workflow.md).

## Day 4 — Ship something small

Good first tasks: a new analytics field, an inbox filter, a webhook event type. Loop:

```bash
npm run dev --workspace=@wco/backend
npm run test --workspace=@wco/backend
npm run lint && npm run typecheck
```

**Goal: merge your first PR end-to-end** (through the whole pipeline incl. CI gates). See [Code review guide](./04-code-review-guide.md) and [Testing guide](./05-testing-guide.md).

## Day 5 — Production shape

- **Deploys:** GitHub Actions → ECR/EKS via ArgoCD (`infra/kubernetes`, overlays per env). See [Deployment guide](./06-deployment-guide.md).
- **Secrets:** AWS Secrets Manager → External Secrets Operator; nothing secret in Git, ever.
- **Dashboards:** Grafana (infra/prometheus rules) + PagerDuty for SEV1.
- **On-call:** rotation documented in Notion; runbook links live in each alert annotation.

Optional: shadow on-call for part of a day to learn the monitoring flow.

## By end of week 1
- [ ] Local stack running; can trace a message end-to-end.
- [ ] Knows tenancy/money/event/error conventions.
- [ ] First PR merged through the pipeline.
- [ ] Set up with the team processes ([Team processes](./08-team-processes.md)).

## Who to ask

| Area | Where to look first |
|---|---|
| Backend/API | `apps/backend/src/modules/<module>` + module README |
| AI engine | `apps/ai-engine/src/{services,modules}` |
| Webhooks/PSPs | `apps/webhook-handler/src/modules` |
| Infra | `infra/kubernetes`; `kubectl get events -n wco-dev` before asking |
| Anything | Your onboarding buddy / squad tech lead |
