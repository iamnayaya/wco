# Development Environment Setup

This guide gets a fresh laptop from zero to a running local WCO stack. New team members should also read [Onboarding: environment](../onboarding/README.md).

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | `>=20.10.0` | Runtime (use `nvm` or `fnm`) |
| npm | `>=10.0.0` | Package manager |
| Docker Desktop | `>=4.25` | Postgres, Redis, RabbitMQ |
| Git | `>=2.40` | Version control |
| VS Code | latest | Recommended editor (see plugins below) |

On Windows, install [WSL2 + Docker Desktop with WSL backend](https://docs.docker.com/desktop/wsl/) for the smoothest experience. macOS/Ubuntu follow the same commands.

## 1. Clone and install

```bash
git clone https://github.com/anomalyco/wco.git
cd wco
npm install
```

> On Windows, if `npm install` hits native module build issues (e.g., `bcrypt`), ensure you're inside WSL2 or have the Windows build tools installed (`npm install --global windows-build-tools`).

## 2. Configure environment

Copy the template and fill in local values:

```bash
cp .env.example .env
# Edit .env — for local dev the defaults mostly work; set JWT secrets anyway
```

**Never commit `.env`.** It is gitignored. Production secrets are managed via AWS Secrets Manager — see [Runbooks: Security](../runbooks/08-security-runbook.md).

## 3. Start infrastructure (Docker)

PostgreSQL, Redis, and RabbitMQ run in Docker:

```bash
npm run docker:up
```

Verify services:

| Service | URL / check |
|---|---|
| PostgreSQL | `localhost:5432` (wco_dev) |
| Redis | `localhost:6379` |
| RabbitMQ | `localhost:5672` · UI `http://localhost:15672` (guest/guest) |

## 4. Migrate & seed the database

```bash
npm run db:migrate   # apply Prisma migrations
npm run db:seed      # deterministic seed data (includes demo merchant)
```

To reset local data:

```bash
npm run db:reset
```

## 5. Run the development servers

Turborepo runs all affected apps with watch mode:

```bash
npm run dev
```

### Local access points

| App | URL |
|---|---|
| Frontend (dashboard) | http://localhost:3000 |
| Backend / API gateway | http://localhost:4000 |
| API docs (Swagger) | http://localhost:4000/api/docs |
| GraphQL playground | http://localhost:4000/graphql |
| AI engine | http://localhost:5000 |
| Admin dashboard | http://localhost:3001 |

### Run a single app (faster loops)

```bash
npm run dev --workspace=@wco/backend
npm run dev --workspace=@wco/frontend
npm run dev --workspace=@wco/ai-engine
```

## 6. Verify the setup

```bash
curl http://localhost:4000/health        # → {"status":"ok", ...}
```

Open http://localhost:3000 and log in with the seeded demo merchant credentials found in `packages/database/prisma/seed.ts`.

## Recommended VS Code settings

Create `.vscode/settings.json` (or rely on repo defaults):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": ["typescript", "typescriptreact"],
  "tailwindCSS.includeLanguages": { "typescript": "javascript", "typescriptreact": "javascript" }
}
```

### Recommended extensions

- ESLint, Prettier, TypeScript Hero
- Prisma, Tailwind CSS IntelliSense
- Mermaid (for diagram preview)
- Postman / REST Client (for API testing)

## Common environment troubleshooting

| Problem | Fix |
|---|---|
| Ports already in use | Change ports in `.env` + `infra/docker/docker-compose.yml`, or stop conflicting services |
| Prisma client not generated | `npx prisma generate` (in `@wco/database`) |
| RabbitMQ won't start | Confirm no port conflict; increase Docker memory |
| Native module build fails (Windows) | Use WSL2 or install Windows build tools |

For deeper issues, see [Developer troubleshooting](./11-troubleshooting-guide.md).

## Working against external integrations

Payments, logistics, WhatsApp, and AI providers require sandbox credentials:

| Integration | Sandbox | Where to configure |
|---|---|---|
| Paystack / Flutterwave / OPay | Test API keys | `.env` + provider dashboard |
| WhatsApp Business API | Meta test number | `.env` + `apps/webhook-handler` |
| Claude / OpenAI | API keys | `.env` + `apps/ai-engine` |
| Logistics (GIG/Kwik/Sendy) | Sandbox keys | `.env` |

Integration code lives behind provider abstractions in `packages/payments`, `packages/logistics`, and `packages/messaging` — you can mock these in tests via `packages/testing`.

Next: [Code style guide](./05-code-style-guide.md).
