# Onboarding — Development Environment Setup

The definitive guide to getting a working local WCO stack. For a fuller, config-by-config breakdown see [Developer: Development environment setup](../developer/04-development-environment-setup.md). This page is the onboarding-specific quick path.

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | >=20.10.0 (use nvm/fnm) |
| npm | >=10.0.0 |
| Docker Desktop | >=4.25 (enable WSL2 backend on Windows) |
| Git | >=2.40 |
| VS Code | latest (+ extensions: ESLint, Prettier, Prisma, Tailwind) |

## 1. Clone & install

```bash
git clone https://github.com/anomalyco/wco.git && cd wco
npm install
npm run prepare        # husky hooks
```

> Windows tip: if native modules (bcrypt etc.) fail, use WSL2 or install Windows build tools.

## 2. Environment

```bash
cp .env.example .env
# defaults work for local dev; still set JWT secrets
```
Never commit `.env` — it's gitignored.

## 3. Infrastructure & DB

```bash
npm run docker:up       # Postgres + Redis + RabbitMQ
npm run db:migrate      # Prisma migrations
npm run db:seed         # deterministic seed incl. demo merchant
```

To wipe local data: `npm run db:reset`.

## 4. Run everything

```bash
npm run dev             # turbo watch: backend + frontend + ai-engine
```

| App | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Swagger docs | http://localhost:4000/api/docs |
| GraphQL | http://localhost:4000/graphql |
| AI engine | http://localhost:5000 |
| Admin | http://localhost:3001 |

Verify: `curl http://localhost:4000/health`.

## 5. External integrations (sandbox)
Payments (Paystack/Flutterwave/OPay), WhatsApp (Meta test number), AI (Claude/OpenAI), and logistics (GIG/Kwik/Sendy) each need sandbox credentials in `.env`. Integration code lives behind abstractions in `packages/payments`, `packages/logistics`, `packages/messaging` — mock via `packages/testing` in tests.

## Quick troubleshooting

| Problem | Fix |
|---|---|
| Ports in use | change in `.env` + `infra/docker/docker-compose.yml` |
| Prisma client missing | `npx prisma generate` (in @wco/database) |
| RabbitMQ won't start | port conflict / Docker memory; `docker:down && docker:up` |
| Native build fails (Win) | WSL2 or build tools |
| Still stuck | [Developer troubleshooting](../developer/11-troubleshooting-guide.md) / ask buddy |

## Working against dev/staging
- Rewrite `.env` values to the dev/staging endpoints when testing against real integrations.
- Production access is break-glass only — never develop against prod.
