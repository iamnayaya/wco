# Onboarding — Team Welcome & Index

Welcome to WCO! This is the master index for new team members and anyone who wants the fast path to productivity.

## The onboarding path (new engineer productive in ≤ 5 days)

| Step | Guide | Day |
|---|---|---|
| Welcome & team | [Welcome](./01-welcome.md) | Day 1 |
| Environment running | [First week](./02-first-week.md) + [Env setup](./03-development-environment-setup.md) | Day 1 |
| Architecture tour | [First week](./02-first-week.md#day-2) + [Architecture overview](../developer/02-architecture-overview.md) | Day 2 |
| Conventions | [First week](./02-first-week.md#day-3) + [Code style](../developer/05-code-style-guide.md) | Day 3 |
| Ship first PR | [Code review guide](./04-code-review-guide.md) + [Testing guide](./05-testing-guide.md) | Day 4 |
| Production shape | [Deployment guide](./06-deployment-guide.md) + [Team processes](./08-team-processes.md) | Day 5 |

## Table of contents

| # | Topic |
|---|---|
| 01 | [Welcome](./01-welcome.md) — who we are, communication, 30-day goals |
| 02 | [Your first week](./02-first-week.md) — day-by-day path |
| 03 | [Development environment setup](./03-development-environment-setup.md) — local stack |
| 04 | [Code review guide](./04-code-review-guide.md) — PRs & reviews |
| 05 | [Testing guide](./05-testing-guide.md) — how we test |
| 06 | [Deployment guide](./06-deployment-guide.md) — how code ships |
| 08 | [Team processes](./08-team-processes.md) — rituals & agreements |
| 09 | [Resources](./09-resources.md) — links, tools, where things live |

## Quick start (Day 1)

```bash
git clone <repo> wco && cd wco
./infra/scripts/bootstrap.sh
cp .env.example .env && npm run dev
```
Verify: `curl localhost:4000/health`; web app http://localhost:3000 (seed credentials in `packages/database/prisma/seed.ts`).

## Day-1 environment cheat sheet

- **API:** localhost:4000 · docs localhost:4000/api/docs · GraphQL localhost:4000/graphql
- **Frontend:** localhost:3000 · **Admin:** localhost:3001 · **AI:** localhost:5000
- **RabbitMQ UI:** localhost:15672 (guest/guest)

## Who to ask

| Area | Where |
|---|---|
| Backend/API | `apps/backend/src/modules/<module>` |
| AI engine | `apps/ai-engine/src/{services,modules}` |
| Webhooks/PSPs | `apps/webhook-handler/src/modules` |
| Infra | `infra/kubernetes`; `kubectl get events -n wco-dev` |
| Anything | onboarding buddy / squad tech lead |
