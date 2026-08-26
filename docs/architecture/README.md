# WCO Architecture Documentation

## Overview

This directory contains all architecture documentation for WhatsApp Commerce OS (WCO).

## Table of Contents

1. [System Architecture](./system-architecture.md) - High-level system design
2. [Data Flow](./data-flow.md) - How data moves through the system
3. [Service Communication](./service-communication.md) - Inter-service communication patterns
4. [Database Design](./database-design.md) - Schema and data model
5. [API Design](./api-design.md) - REST and GraphQL API structure
6. [Security Architecture](./security-architecture.md) - Security layers and controls
7. [Deployment Architecture](./deployment-architecture.md) - Infrastructure and deployment
8. [Scalability Patterns](./scalability-patterns.md) - Horizontal/vertical scaling strategies
9. [ADR Index](./adr/README.md) - Architecture Decision Records

> **Canonical database documentation**: [docs/database/](../database/README.md) — ERD, table reference,
> indexing strategy, partitioning/sharding, data lifecycle & archival, security/RLS/GDPR, performance,
> Redis/Elasticsearch data designs, backup & DR.
>
> **Canonical API documentation**: [docs/api/README.md](../api/README.md) — architecture & gateway design,
> REST guidelines, auth/RBAC, OpenAPI 3.1 spec (68 paths / 105 ops), webhooks, GraphQL, observability,
> testing strategy, code examples & SDKs.

## Quick Reference

### Core Services

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| API Gateway | 4000 | NestJS | Entry point, auth, rate limiting |
| Backend API | 4001 | NestJS | Core business logic |
| AI Engine | 5000 | FastAPI/Python | AI/ML processing |
| Webhook Handler | 4002 | NestJS | External webhook processing |
| Frontend | 3000 | Next.js | Merchant dashboard |
| Admin Dashboard | 3001 | Next.js | Internal admin panel |
| Mobile API | 4003 | NestJS | Mobile app backend |

### Data Stores

| Store | Technology | Purpose |
|-------|------------|---------|
| Primary DB | PostgreSQL 15 | Transactional data |
| Cache | Redis 7 | Sessions, caching, queues |
| Message Queue | RabbitMQ | Async processing |
| Vector DB | Pinecone | AI embeddings |
| Object Storage | AWS S3 | Files, images, documents |
| Search | Elasticsearch | Full-text search, logs |
| Analytics | ClickHouse | OLAP, analytics |

### External Integrations

| Category | Providers |
|----------|-----------|
| WhatsApp | Twilio, Meta WhatsApp Business API |
| Payments | Paystack, Flutterwave, OPay |
| Logistics | GIG, Kwik, Sendy |
| Email | SendGrid, AWS SES |
| Monitoring | Datadog, Prometheus, Grafana |
| Error Tracking | Sentry |

## Diagrams

All diagrams are in Mermaid format for version control and rendering in GitHub/GitLab.

- [System Context Diagram](./diagrams/system-context.mmd)
- [Container Diagram](./diagrams/container.mmd)
- [Component Diagram](./diagrams/component.mmd)
- [Deployment Diagram](./diagrams/deployment.mmd)
- [Data Flow Diagram](./diagrams/data-flow.mmd)
- [Sequence Diagrams](./diagrams/sequences/)

## Architecture Principles

1. **Domain-Driven Design**: Bounded contexts align with business capabilities
2. **Event-Driven**: Async communication via domain events
3. **API-First**: Contracts defined before implementation
4. **Observability-First**: Metrics, logs, traces built-in
5. **Security by Design**: Zero-trust, least privilege
6. **Cloud-Native**: Containerized, stateless, scalable
7. **Data Privacy**: GDPR/NDPR compliance built-in
8. **Failure Resilience**: Circuit breakers, retries, dead letters

## Technology Decisions

See [ADR Index](./adr/README.md) for all Architecture Decision Records.