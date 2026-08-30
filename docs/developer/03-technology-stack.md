# Technology Stack

This page is the canonical reference for the technologies used across WCO. Full decision rationale lives in the Architecture Decision Records ([`docs/adr/`](../adr/)) and [Technology choices](../architecture/technology-choices.md).

## Monorepo tooling

| Tool | Purpose | Notes |
|---|---|---|
| npm workspaces | Workspace management | `workspaces: ["apps/*", "packages/*", "tools/*"]` |
| Turborepo | Task orchestration & caching | `turbo run <task>`; remote caching for CI speed |
| TypeScript 5.3 | Language (strict) | Shared `tsconfig` packages |
| Husky + lint-staged | Git hooks | Commit-msg validation, pre-commit lint/format |
| Commitlint | Conventional commits | `@commitlint/config-conventional` |
| Prettier + ESLint | Formatting & lint | Shared config packages |

## Backend

| Area | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript (strict) |
| Framework | NestJS 10 (modular, DI) |
| ORM | Prisma |
| Database | PostgreSQL 15 (RLS-enabled) |
| Cache / sessions | Redis 7 |
| Message queue | RabbitMQ 3.12 |
| Validation | class-validator + class-transformer (whitelist mode) |
| Auth | JWT + refresh tokens + RBAC + API keys |
| Testing | Jest + ts-jest + Testcontainers (integration) |
| Docs | NestJS Swagger + `docs/api/openapi.yaml` |

## Frontend (web dashboard)

| Area | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript, React 18 |
| Styling | Tailwind CSS |
| State | Zustand + TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| Charts | Recharts + Tremor |
| Testing | Vitest + Testing Library; Playwright (E2E) |
| a11y | axe-core (WCAG 2.1 AA) |

## Mobile

| Area | Technology |
|---|---|
| Framework | React Native 0.73 + TypeScript |
| Build | Expo SDK 50 |
| Platform | iOS + Android (single codebase) |
| Testing | Jest + Maestro / Detox (E2E) |

## AI engine

| Area | Technology |
|---|---|
| LLMs | Anthropic Claude (Opus/engines) + OpenAI GPT-4 Turbo |
| Vector DB | Pinecone |
| Embeddings | OpenAI text-embedding-3-large |
| Orchestration / prompts | LangChain + custom templates |
| Application | `apps/ai-engine` (FastAPI/Python service + NestJS adapters) |

## Infrastructure & deployment

| Area | Technology |
|---|---|
| Cloud | AWS (EKS, RDS, ElastiCache, S3, CloudFront, Secrets Manager) |
| Container | Docker + Kubernetes (EKS) |
| IaC | Terraform (infra) + Helm charts |
| CI/CD | GitHub Actions + ArgoCD |
| Continuous delivery | Argo Rollouts (canary) |
| Monitoring | Datadog + Prometheus + Grafana + Alertmanager |
| Logging | ELK (Elasticsearch, Logstash, Kibana) / S3 archive |
| Tracing | OpenTelemetry + Jaeger |
| Error tracking | Sentry |

## Payments & logistics

| Category | Providers |
|---|---|
| Payments | Paystack, Flutterwave, OPay |
| Logistics | GIG Logistics, Kwik Delivery, Sendy |
| WhatsApp | Twilio + Meta WhatsApp Business API |
| Email | SendGrid + AWS SES |

## Docs & quality

| Area | Technology |
|---|---|
| Docs platform | Docusaurus 3 (docs-as-code) |
| API reference | Redocly from OpenAPI 3.1 |
| Diagrams | Mermaid |
| Code docs | TSDoc + TypeDoc |
| SAST/DAST | Semgrep, CodeQL, ZAP |
| Dependency policy | Snyk |
| Secret scanning | gitleaks |

## Version requirements

- Node.js `>=20.0.0`, npm `>=10.0.0`
- Docker Desktop, PostgreSQL 15+, Redis 7+, RabbitMQ 3.12+
- See [Development environment setup](./04-development-environment-setup.md) for install instructions.

Next: [Development environment setup](./04-development-environment-setup.md).
