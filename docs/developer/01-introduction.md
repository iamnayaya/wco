# Developer Documentation — Introduction

## What is WCO?

**WhatsApp Commerce OS (WCO)** is an AI-powered operating system that helps informal traders in emerging markets (Nigeria, Ghana, Kenya, and beyond) run their WhatsApp-based businesses with speed, efficiency, and zero hassle. It turns a merchant's WhatsApp number into a full commerce platform: product catalog, ordering, payments, logistics, customer management, and an AI auto-responder that answers customer inquiries in ~5 seconds.

WCO is delivered as:

- **A web dashboard** (Next.js) merchants use to run their store.
- **A mobile app** (React Native / Expo) for on-the-go management.
- **A public API** (`/api/v1`, OpenAPI) for integrations and automation.
- **An AI engine** that powers auto-replies, pricing optimization, and forecasting.

## Why WCO?

Informal traders run a huge share of commerce in emerging markets, but they are underserved by enterprise platforms that assume formal business structures, reliable internet, banks, and large catalogs. WCO meets them where they are — **on WhatsApp** — and removes the friction of:
- Manually replying to the same product questions all day.
- Tracking orders and customers in notebooks.
- Chasing payments across multiple channels.
- Coordinating delivery logistics by phone.

The result: a merchant can spend 5 minutes setting up their store and immediately accept orders, take payments, and arrange delivery — with an AI assistant handling routine conversations.

## Documentation map

| I need to… | Go to |
|---|---|
| Understand the system architecture | [Architecture overview](./02-architecture-overview.md) |
| See the tech stack table | [Technology stack](./03-technology-stack.md) |
| Set up my local environment | [Development environment setup](./04-development-environment-setup.md) |
| Follow code conventions | [Code style guide](./05-code-style-guide.md) |
| Understand branching & commits | [Git workflow](./06-git-workflow.md) |
| Submit / review code | [Code review process](./07-code-review-process.md) |
| Write & run tests | [Testing guide](./08-testing-guide.md) |
| Deploy to an environment | [Deployment guide](./09-deployment-guide.md) |
| Monitor & debug | [Monitoring & logging guide](./10-monitoring-logging-guide.md) |
| Resolve common dev problems | [Troubleshooting guide](./11-troubleshooting-guide.md) |
| Contribute / open a PR | [Contributing guide](./12-contributing-guide.md) |
| See what changed | [Changelog](./13-changelog.md) |

## Development principles

1. **Domain-Driven Design** — bounded contexts map to business capabilities.
2. **Event-Driven** — async communication via domain events and the transactional outbox (see [ADR-002](../adr/ADR-002-transactional-outbox.md)).
3. **API-First** — contracts are defined and reviewed before implementation; `openapi.yaml` is the source of truth.
4. **Observability-First** — metrics, structured logs, and traces are built into every service.
5. **Security by Design** — zero-trust, least privilege, tenant isolation enforced at every layer.
6. **Cloud-Native** — containerized, stateless, horizontally scalable.
7. **Data Privacy** — GDPR/NDPR compliance built-in, not bolted on.
8. **Failure Resilience** — circuit breakers, retries, and dead-letter queues everywhere.

## Quick facts

| Attribute | Value |
|---|---|
| Monorepo manager | npm workspaces + Turborepo |
| Language | TypeScript (strict) across backend, frontend, mobile; Python for parts of the AI engine |
| Backend framework | NestJS 10 (modular) |
| Database | PostgreSQL 15 (Prisma ORM) + Redis 7 |
| Queue | RabbitMQ 3.12 |
| Docs platform | Docusaurus (see [Platform setup](../platform-style/01-platform-setup.md)) |
| CI/CD | GitHub Actions + ArgoCD |
| Cloud | AWS (EKS, RDS, ElastiCache, S3, CloudFront) |

Continue to [Architecture overview](./02-architecture-overview.md).
