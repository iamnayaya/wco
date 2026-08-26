# WhatsApp Commerce OS (WCO)

> **AI-powered operating system for informal traders in emerging markets to run WhatsApp-based businesses with speed, efficiency, and zero hassle.**

## Overview

WCO is a comprehensive SaaS platform that enables informal traders in Nigeria, Ghana, Kenya, and other emerging markets to automate and scale their WhatsApp commerce operations. Built with modern technology stack following Silicon Valley best practices for scalability, security, and maintainability.

## Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| **AI Auto-Responder** | Answer customer inquiries in 5 seconds using Claude/OpenAI | ✅ |
| **Payment Integration** | Receive payments via Paystack, Flutterwave, OPay in 1 minute | ✅ |
| **Logistics Integration** | Arrange delivery via GIG, Kwik, Sendy in 2 minutes | ✅ |
| **Customer Management** | Track customers 24/7 with CRM capabilities | ✅ |
| **AI Pricing Optimizer** | Dynamic pricing based on demand, competition, inventory | ✅ |
| **Marketing Automation** | Auto-follow-up, abandoned cart recovery, campaigns | ✅ |
| **Analytics Dashboard** | Real-time sales, customer, product analytics | ✅ |
| **Multi-Store Support** | Manage multiple stores from single dashboard | ✅ |

## Tech Stack

### Frontend
- **Web**: React 18 + TypeScript + Next.js 14 (App Router) + Tailwind CSS
- **Mobile**: React Native 0.73 + TypeScript + Expo SDK 50
- **State**: Zustand + React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts + Tremor

### Backend
- **Runtime**: Node.js 20 LTS + TypeScript
- **Framework**: NestJS 10 (modular architecture)
- **Database**: PostgreSQL 15 (Prisma ORM) + Redis 7 (caching/sessions)
- **Message Queue**: RabbitMQ 3.12
- **API**: REST + GraphQL (Apollo Server)
- **Auth**: JWT + Refresh Tokens + RBAC + API Keys

### AI Engine
- **LLM Providers**: Anthropic Claude 3 Opus + OpenAI GPT-4 Turbo
- **Vector DB**: Pinecone
- **Embeddings**: OpenAI text-embedding-3-large
- **Prompt Engineering**: LangChain + Custom Templates

### Infrastructure
- **Cloud**: AWS (EKS, RDS, ElastiCache, S3, CloudFront)
- **Container**: Docker + Kubernetes (EKS)
- **IaC**: Terraform + Helm Charts
- **CI/CD**: GitHub Actions + ArgoCD
- **Monitoring**: Datadog + Prometheus + Grafana + Alertmanager
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing**: OpenTelemetry + Jaeger

### Payments & Logistics
- **Payments**: Paystack, Flutterwave, OPay
- **Logistics**: GIG Logistics, Kwik Delivery, Sendy
- **WhatsApp**: Twilio + Meta WhatsApp Business API

## Project Structure

```
wco/
├── apps/
│   ├── backend/              # NestJS API Server
│   ├── frontend/             # Next.js Web Dashboard
│   ├── mobile/               # React Native Mobile App
│   ├── ai-engine/            # AI/ML Microservice
│   ├── webhook-handler/      # Webhook Processing Service
│   └── admin-dashboard/      # Admin Panel (Next.js)
├── packages/
│   ├── shared/               # Shared types, utils, constants
│   ├── ui/                   # Shared UI Components (React)
│   ├── config/               # Configuration Management
│   ├── database/             # Database Entities, Repositories
│   ├── auth/                 # Authentication Library
│   ├── payments/             # Payment Providers Abstraction
│   ├── logistics/            # Logistics Providers Abstraction
│   ├── analytics/            # Analytics Events & Processors
│   ├── messaging/            # Messaging Templates & Providers
│   ├── testing/              # Testing Utilities & Fixtures
│   ├── eslint-config/        # Shared ESLint Config
│   └── tsconfig/             # Shared TypeScript Config
├── tools/
│   ├── generators/           # Code Generators (Plop)
│   ├── scripts/              # Utility Scripts
│   ├── cli/                  # Custom CLI Tools
│   ├── migration/            # Database Migration Tools
│   └── benchmark/            # Performance Benchmarks
├── infra/
│   ├── kubernetes/           # K8s Manifests (Base + Overlays)
│   ├── terraform/            # Terraform Modules & Envs
│   ├── docker/               # Dockerfiles & Compose
│   ├── helm/                 # Helm Charts
│   ├── scripts/              # Infra Scripts
│   ├── monitoring/           # Monitoring Configs
│   └── security/             # Security Policies & Certs
└── docs/
    ├── architecture/         # Architecture Decision Records
    ├── api/                  # API Documentation
    ├── guides/               # Developer Guides
    ├── adr/                  # Architecture Decision Records
    ├── security/             # Security Documentation
    └── onboarding/           # Team Onboarding
```

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3.12+

### Installation

```bash
# Clone repository
git clone https://github.com/wco/wco.git
cd wco

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start infrastructure
npm run docker:up

# Run database migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start development servers
npm run dev
```

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Docs (Swagger)**: http://localhost:4000/api/docs
- **GraphQL Playground**: http://localhost:4000/graphql
- **AI Engine**: http://localhost:5000
- **Admin Dashboard**: http://localhost:3001

## Development Workflow

### Git Branching Strategy
```
main (protected)
  └── develop (protected)
        ├── feature/JIRA-123-description
        ├── bugfix/JIRA-456-description
        ├── hotfix/JIRA-789-description
        └── release/v1.2.0
```

### Commit Convention
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add AI auto-responder for product inquiries
fix: resolve payment webhook timeout issue
docs: update API documentation for orders endpoint
refactor: extract pricing logic to separate service
test: add integration tests for customer module
chore: update dependencies
```

### Code Review Process
1. Create PR from feature branch to `develop`
2. Ensure all CI checks pass (lint, typecheck, tests)
3. Request review from 2 team members
4. Address feedback
5. Squash and merge to `develop`

## Testing Strategy

| Type | Coverage Target | Tools |
|------|----------------|-------|
| Unit | 80%+ | Jest + Vitest |
| Integration | 70%+ | Jest + Testcontainers |
| E2E | Critical paths | Playwright + Detox |
| Contract | All APIs | Pact |
| Load | 100K RPS | k6 |

Run tests:
```bash
# All tests
npm run test

# Unit only
npm run test:unit

# Integration only
npm run test:integration

# E2E only
npm run test:e2e
```

## Deployment

### Environments
| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| Development | `develop` | dev.wco.com | Integration testing |
| Staging | `release/*` | staging.wco.com | Pre-production validation |
| Production | `main` | app.wco.com | Live traffic |

### Deploy Commands
```bash
# Development
npm run k8s:deploy:dev

# Staging
npm run k8s:deploy:staging

# Production (requires approval)
npm run k8s:deploy:prod
```

## Architecture

See [Architecture Documentation](docs/architecture/README.md) for detailed diagrams and design decisions.

## Security

- **Authentication**: JWT with short expiry + refresh tokens
- **Authorization**: RBAC with resource-level permissions
- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **API Security**: Rate limiting, CORS, Helmet, API Keys
- **Compliance**: GDPR, NDPR (Nigeria), POPIA (South Africa)
- **Audit**: Comprehensive audit logging for all sensitive operations

See [Security Documentation](docs/security/README.md) for details.

## Monitoring & Observability

- **Metrics**: Prometheus + Grafana dashboards
- **Logs**: Centralized logging with ELK
- **Traces**: OpenTelemetry + Jaeger
- **Alerts**: Alertmanager + PagerDuty integration
- **Uptime**: Synthetic monitoring with Datadog

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Code style & conventions
- Pull request process
- Testing requirements
- Documentation standards

## License

Proprietary - All rights reserved - WhatsApp Commerce OS Inc.

## Support

- **Documentation**: https://docs.wco.com
- **API Reference**: https://api.wco.com/docs
- **Status Page**: https://status.wco.com
- **Support Email**: support@wco.com
- **Slack**: #wco-support