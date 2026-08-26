# WCO System Architecture

## Executive Summary

WhatsApp Commerce OS (WCO) is a cloud-native, event-driven SaaS platform built on a modular monolith backend with strategically extracted microservices. The architecture is designed for 1M+ merchants, 100K+ requests/second, and sub-5-second AI response times while maintaining 99.95% availability.

## Architecture Principles

1. **Modular Monolith First**: Start simple, extract services when scale demands it
2. **Event-Driven**: Async processing via domain events (RabbitMQ)
3. **API-First**: OpenAPI contracts before implementation
4. **Multi-Tenancy**: Row-level isolation with tenant context propagation
5. **Zero-Trust Security**: Every request authenticated & authorized
6. **Observability-First**: Distributed tracing, metrics, structured logs
7. **Failure Isolation**: Circuit breakers, bulkheads, graceful degradation

---

## 1. High-Level System Context Diagram

Shows WCO in relation to external actors and systems:

```mermaid
graph TB
    subgraph "Actors"
        M[Merchant<br/>Nigeria/Ghana/Kenya]
        C[Customer<br/>WhatsApp User]
        A[Admin<br/>WCO Staff]
    end

    subgraph "WCO Platform"
        WEB[Web Dashboard]
        MOB[Mobile App]
        ADM[Admin Dashboard]
        API[Backend API]
        AI[AI Engine]
    end

    subgraph "External Systems"
        WA[WhatsApp Business API<br/>Meta/Twilio]
        PAY[Payment Providers<br/>Paystack, Flutterwave, OPay]
        LOG[Logistics Providers<br/>GIG, Kwik, Sendy]
        LLM[AI Providers<br/>Claude, GPT-4]
        EMAIL[Email Services<br/>SendGrid]
    end

    M -->|manages store| WEB
    M -->|manages store| MOB
    A -->|administers| ADM
    C -->|"sends messages"| WA
    WA -->|webhooks| API
    API -->|send/receive| WA
    API -->|process payments| PAY
    PAY -->|payment webhooks| API
    API -->|create shipments| LOG
    LOG -->|status updates| API
    AI -->|generate responses| LLM
    WEB -->|REST/GraphQL| API
    MOB -->|REST| API
    ADM -->|REST| API
```

---

## 2. Container Diagram (C4 Level 2)

Detailed view of the containers within the WCO platform:

```mermaid
graph TB
    subgraph "Client Layer - CDN (Cloudflare)"
        CF[Cloudflare CDN + WAF]
    end

    subgraph "Presentation Layer"
        WEB[Next.js Web Dashboard<br/>React 18 / SSR / PWA]
        MOB[Mobile App<br/>React Native / Expo]
        ADM[Admin Dashboard<br/>Next.js]
    end

    subgraph "Edge Layer"
        LB[AWS ALB<br/>Load Balancer]
        APIGW[API Gateway<br/>Kong/NestJS Middleware]
    end

    subgraph "Application Layer - EKS"
        direction TB
        subgraph "Core Services"
            BE[Backend API<br/>NestJS Modular Monolith<br/>Auth, Stores, Products,<br/>Orders, Customers]
            WH[Webhook Handler<br/>Dedicated Service<br/>High-throughput ingestion]
        end
        subgraph "Async Workers"
            WK[Worker Pool<br/>Queue Consumers<br/>Emails, Notifications,<br/>Analytics Events]
            CRON[Cron Scheduler<br/>Abandoned Carts,<br/>Price Optimization]
        end
        subgraph "AI Layer"
            AI[AI Engine<br/>Auto-Responder, Pricing,<br/>Sentiment, Forecasting]
        end
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 15<br/>Primary + Replicas<br/>PgBouncer)]
        RD[(Redis Cluster<br/>Cache, Sessions,<br/>Rate Limits, Queues)]
        MQ[RabbitMQ Cluster<br/>Domain Events,<br/>Dead Letter Queues]
        PC[Pinecone<br/>Vector Database<br/>Product Embeddings]
        S3[S3 Buckets<br/>Images, Documents,<br/>Backups]
    end

    subgraph "Observability"
        DD[Datadog APM/Metrics]
        SNY[Sentry Errors]
        JG[Jaeger Tracing]
        ELK[ELK Logs]
    end

    %% Client flows
    CF --> WEB
    CF --> ADM
    MOB --> LB

    %% Edge routing
    WEB -->|HTTPS/WSS| LB
    ADM -->|HTTPS| LB
    LB --> BE
    LB --> WH
    LB --> AI

    %% Core service dependencies
    BE --> PG
    BE --> RD
    BE --> MQ
    BE --> PC
    AI --> LLM
    AI --> PG
    AI --> PC
    WH --> MQ
    WK --> MQ
    CRON --> MQ

    %% External integrations from services
    BE --> WA
    BE --> PAY
    BE --> LOG

    %% Observability
    BE -.->|metrics/traces| DD
    BE -.->|errors| SNY
    AI -.->|traces| JG
```

---

## 3. Component Diagram — Backend API (C4 Level 3)

```mermaid
graph TB
    subgraph "Backend API - NestJS Modular Monolith"
        subgraph "Common Layer"
            GRD[Guards: JWT, RBAC,<br/>Tenant, Rate Limit]
            INT[Interceptors: Logging,<br/>Transform, Timeout]
            FLT[Filters: Exception,<br/>Validation]
        end

        subgraph "Modules (Bounded Contexts)"
            AUTH[Auth Module<br/>Login, Register,<br/>Refresh, MFA]
            USR[Users Module]
            STR[Stores Module<br/>Multi-store mgmt]
            PRD[Products Module<br/>Catalog, Inventory]
            ORD[Orders Module<br/>Checkout, Fulfillment]
            CUS[Customers Module<br/>CRM, Segments]
            PAY[Payments Module<br/>Paystack, Flutterwave,<br/>OPay adapters]
            LGX[Logistics Module<br/>GIG, Kwik, Sendy]
            MSG[Messaging Module<br/>WhatsApp send/rec]
            ANA[Analytics Module<br/>Aggregations, Reports]
            MRK[Marketing Module<br/>Campaigns, Cart Recovery]
            PRC[Pricing Module<br/>Dynamic Pricing]
            NOT[Notifications Module]
        end

        subgraph "Infrastructure"
            DB[(Prisma Client)]
            CACHE[Redis Client]
            QUEUE[BullMQ Producers]
        end
    end

    GRD --> AUTH
    AUTH --> USR
    ORD --> PAY
    ORD --> LGX
    MSG --> AI
    ANA --> DB
```

---

## 4. Key Data Flows

### 4.1 Customer Message → AI Auto-Response (< 5s)

The flagship flow. Customer sends WhatsApp message; AI replies in seconds.

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant WA as WhatsApp (Meta/Twilio)
    participant WH as Webhook Handler
    participant MQ as RabbitMQ
    participant AI as AI Engine
    participant LLM as Claude/GPT-4
    participant PG as PostgreSQL
    participant RD as Redis
    participant WS as WebSocket Gateway

    C->>WA: "How much is the Ankara fabric?"
    WA->>WH: POST /webhooks/whatsapp (signed)
    WH->>WH: Verify HMAC signature
    WH->>MQ: Publish message.received (fast ack <50ms)
    WH-->>WA: 200 OK (immediately)

    par Parallel Processing
        MQ->>AI: Consume message.received
        AI->>RD: Get conversation history (cached)
        AI->>PG: Load product catalog context
        AI->>LLM: Generate response (streaming)
        LLM-->>AI: "Hi! The Ankara fabric is ₦8,500 per yard..."
    and
        MQ->>PG: Persist message (async)
    end

    AI->>WA: Send reply via Business API
    WA->>C: Deliver AI response (~3-5s total)
    AI->>WS: Broadcast to merchant dashboard
    Note over WS: Merchant sees live conversation
```

### 4.2 Payment Flow (Paystack example)

```mermaid
sequenceDiagram
    autonumber
    participant M as Merchant
    participant FE as Frontend
    participant API as Backend API
    participant PS as Paystack
    participant MQ as RabbitMQ
    participant C as Customer

    M->>FE: Create payment link for order
    FE->>API: POST /api/v1/payments/link
    API->>PS: Create transaction
    PS-->>API: payment_url + reference
    API-->>FE: Payment link
    FE-->>M: Share link via WhatsApp

    C->>PS: Complete payment
    PS->>API: POST /webhooks/paystack (HMAC signed)
    API->>API: Verify signature + idempotency check
    API->>PG: Update order status (atomic txn)
    API->>MQ: Emit payment.succeeded
    API-->>PS: 200 OK
    
    par Async Side Effects
        MQ->>API: Notify customer (WhatsApp receipt)
        MQ->>API: Trigger fulfillment workflow
        MQ->>API: Update analytics aggregates
        MQ->>API: Loyalty points update
    end
```

### 4.3 Delivery Arrangement Flow

```mermaid
sequenceDiagram
    autonumber
    participant M as Merchant
    participant API as Backend API
    participant LGX as Logistics Service
    participant GIG as GIG/Kwik/Sendy
    participant MQ as RabbitMQ
    participant C as Customer

    M->>API: Request delivery for order
    API->>LGX: Get quotes from all providers
    par Provider Fan-out
        LGX->>GIG: Quote request
        GIG-->>LGX: ₦2,500, 2 days
    and
        LGX->>KWIK: Quote request  
        KWIK-->>LGX: ₦3,000, 1 day
    end
    LGX-->>M: Sorted quotes (cheapest/fastest)
    M->>API: Select provider + confirm
    API->>GIG: Create shipment
    GIG-->>API: tracking_number
    API->>MQ: Emit shipment.created
    MQ->>C: Send tracking link via WhatsApp
    loop Status Polling / Webhooks
        GIG->>API: status_updates webhook
        API->>C: Progress notifications
    end
```

### 4.4 Abandoned Cart Recovery

```mermaid
flowchart LR
    A[Cart Created] --> B{Purchase completed?}
    B -->|No, after 1h| C[Reminder 1:<br/>Friendly nudge]
    B -->|No, after 24h| D[Reminder 2:<br/>+ Social proof]
    B -->|No, after 72h| E[Final offer:<br/>Discount code]
    C --> F{Responded?}
    D --> F
    E --> F
    F -->|Yes| G[Resume conversation]
    F -->|No| H[Mark lost,<br/>add to retargeting segment]
```

---

## 5. Multi-Tenancy Model

WCO uses **shared database, shared schema** with row-level tenant isolation:

```
┌─────────────────────────────────────────────────┐
│                  PostgreSQL                      │
│  ┌───────────────────────────────────────────┐  │
│  │              Single Schema                 │  │
│  │                                            │  │
│  │  stores ──┬── products                     │  │
│  │           ├── orders                        │  │
│  │           ├── customers                     │  │
│  │           └── conversations                 │  │
│  │                                            │  │
│  │  Every row scoped by store_id/user_id      │  │
│  │  Enforced by:                              │  │
│  │   • Prisma middleware (app layer)          │  │
│  │   • Tenant guard (request layer)           │  │
│  │   • Postgres RLS (defense-in-depth)        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Why this model?**
- 1M+ tenants × small data each = pooling efficiency
- Cheapest option at startup scale (single DB)
- Migration path to schema-per-tenant or DB-per-tenant for enterprise customers documented in [ADR-007]

**Tenant context propagation:**
```
Request → JWT → { userId, storeId } → AsyncLocalStorage → Prisma middleware auto-filters
```

---

## 6. Scalability Design Decisions

| Bottleneck Risk | Mitigation |
|-----------------|------------|
| WhatsApp webhook bursts | Dedicated webhook-handler service, queue-based load leveling |
| AI latency spikes | Response streaming, prompt caching, fallback models, semantic cache |
| DB connection exhaustion | PgBouncer (transaction mode), read replicas |
| Hot products/stores | Redis cache-aside pattern, CDN for images |
| Analytics slowing OLTP | Separate ClickHouse cluster, async aggregation |
| Queue backlog | Horizontal worker autoscaling (KEDA), DLQ + replay tooling |
| Traffic spikes (Black Friday) | HPA + predictive scaling, pre-warmed capacity |

## 7. Availability & Failure Modes

| Failure | Impact | Mitigation | Recovery |
|---------|--------|------------|----------|
| Claude API down | No AI replies | Failover to GPT-4 → template fallback | Auto-retry w/ backoff |
| Paystack down | Payment failures | Circuit breaker, retry queue, alternate PSP | Automatic provider failover |
| Primary DB down | Writes fail | Promote replica (RDS multi-AZ, ~60s) | Automated failover |
| Redis down | Cache misses | Serve stale, degrade gracefully | Rebuild from source |
| RabbitMQ down | Delayed async work | Messages buffer in-memory, alerting | Mirror queues (quorum) |
| Region outage | Full outage | Route53 failover to secondary region | RTO: 15min, RPO: 5min |

**SLOs:**
- API availability: 99.95% monthly
- AI response p95: < 5s end-to-end
- Payment webhook processing: p99 < 30s
- Dashboard TTFB: p75 < 1.2s

## 8. Future Evolution Path

```
Phase 1 (Now):     Modular monolith + extracted AI/webhook services
Phase 2 (10K merchants): Extract Orders/Payments into separate deployables
Phase 3 (100K merchants): Event sourcing for order lifecycle, CQRS reads
Phase 4 (1M merchants): Cell-based architecture (regional cells), 
                         dedicated DB clusters for enterprise tier
```
