# WCO Data Flow Architecture

## Overview

This document details how data moves through the WCO system, covering ingestion paths, processing pipelines, storage strategies, and data lifecycle management.

## 1. Data Classification

| Class | Examples | Storage | Encryption | Retention |
|-------|----------|---------|------------|-----------|
| **PII-Critical** | Phone numbers, addresses, payment tokens | PostgreSQL (encrypted columns) | AES-256-GCM field-level | Per NDPR/GDPR policy |
| **Business Data** | Products, orders, customers | PostgreSQL | At-rest encryption | 7 years (tax law) |
| **Conversational** | WhatsApp messages, AI responses | PostgreSQL + Elasticsearch index | At-rest encryption | 24 months |
| **Behavioral** | Page views, clicks, events | ClickHouse | At-rest | 13 months |
| **Derived/ML** | Embeddings, forecasts, segments | Pinecone + PG | N/A | Regenerable |
| **Media** | Product images, logos | S3 + CloudFront | SSE-S3 | Until deleted |
| **Secrets** | API keys, tokens | AWS Secrets Manager | KMS CMK | Rotated 90d |

## 2. Ingestion Paths

### 2.1 Real-Time Streams

```mermaid
flowchart LR
    subgraph "Sources"
        WA[WhatsApp Webhooks]
        PS[Paystack Webhooks]
        FW[Flutterwave Webhooks]
        LGX[Logistics Webhooks]
        APP[Mobile/Web Events]
    end

    subgraph "Ingestion"
        WH[Webhook Handler<br/>Signature verify →<br/>Dedupe → Fast ack]
        SDK[WCO Analytics SDK<br/>Batched every 5s]
    end

    subgraph "Buffering"
        MQ[(RabbitMQ<br/>Quorum queues)]
        KIN[Kinesis Firehose<br/>for analytics events]
    end

    subgraph "Processing"
        WK[Workers<br/>Idempotent consumers]
        STR[Stream Processor<br/>Flink/Kinesis Analytics]
    end

    subgraph "Storage"
        PG[(PostgreSQL)]
        CH[(ClickHouse)]
        ES[(Elasticsearch)]
        RD[(Redis)]
    end

    WA --> WH
    PS --> WH
    FW --> WH
    LGX --> WH
    APP --> SDK
    WH --> MQ
    SDK --> KIN
    MQ --> WK
    KIN --> STR
    WK --> PG
    WK --> RD
    STR --> CH
    PG -.->|CDC Debezium| CH
    PG -.->|CDC| ES
```

**Key guarantees:**
- **At-least-once delivery**: All webhooks acked only after durable enqueue
- **Idempotency**: Every webhook carries provider event ID; Redis dedupe window 72h
- **Ordering**: Per-conversation ordering via consistent-hash exchange on `wa_phone_number`
- **Backpressure**: Webhook handler returns 200 immediately; queue absorbs bursts up to 50K msg/s

### 2.2 Batch Pipelines

```mermaid
flowchart TB
    subgraph "Nightly (02:00 WAT)"
        A1[Analytics Aggregation] --> A2[Materialized views refresh]
        A3[Customer LTV recompute] --> A4[Segment assignment]
        A5[Demand forecasting] --> A6[Pricing recommendations]
    end
    
    subgraph "Weekly (Sunday 04:00)"
        B1[Full DB backup verification]
        B2[Data quality checks]
        B3[ML model retraining]
        B4[Embeddings refresh for changed products]
    end

    subgraph "Monthly"
        C1[Partition maintenance]
        C2[Archive cold data to S3]
        C3[Compliance report generation]
    end
```

## 3. Read vs Write Path Separation (CQRS-Lite)

```mermaid
flowchart LR
    subgraph "Write Path"
        W1[Command APIs] --> W2[PostgreSQL Primary]
        W2 --> W3[Emit domain event to RabbitMQ]
    end

    subgraph "Sync"
        CDC[CDC / Change Data Capture<br/>Debezium]
    end

    subgraph "Read Path"
        R0[PostgreSQL Replicas<br/>p95 < 50ms reads] 
        R1[Redis Cache-Aside<br/>hit ratio target >85%]
        R2[ClickHouse Aggregates<br/>dashboard analytics]
        R3[Elasticsearch<br/>search & conversation history]
    end

    W2 --> CDC
    CDC --> R2
    CDC --> R3
    W1 -.->|reads| R1
    W1 -.->|heavy queries| R0
    ANA[Analytics Dashboard] --> R2
    SCH[Search UI] --> R3
```

**Rules:**
- Writes always hit primary; reads prefer cache → replica → primary fallback
- Eventual consistency window: < 2s typical; UI uses optimistic updates + refetch
- Dashboard analytics NEVER query OLTP tables directly — always ClickHouse aggregates

## 4. Caching Strategy

| Layer | What | TTL | Invalidations |
|-------|------|-----|---------------|
| Browser/CDN | Static assets, JS/CSS bundles | Immutable, hashed filenames | Deploy = new hashes |
| Cloudflare | Product images, public catalog pages | 24h + stale-while-revalidate | Purge API on product change |
| Redis L1 (app) | Session data, JWT blacklist, feature flags | 15m - 24h | Explicit on write |
| Redis L2 (entity) | Product, store, customer profiles | 5m - 1h | Event-driven: entity.updated |
| Request memo | Deduped identical queries in flight | ms | Automatic |

**Cache stampede protection:** Request coalescing with distributed locks (Redlock) + jittered TTLs (±10%).

## 5. Message Flow Patterns (RabbitMQ)

### Exchange Topology

```mermaid
flowchart TB
    subgraph "Exchanges"
        DX[domain.events<br/>topic exchange]
        CX[commands<br/>direct exchange]
        DEX[webhooks.dead<br/>DLX]
    end

    subgraph "Queues"
        Q1[q.ai.auto-responder]
        Q2[q.orders.fulfillment]
        Q3[q.notifications.whatsapp]
        Q4[q.analytics.events]
        Q5[q.marketing.cart-recovery]
        QDL[q.dead-letter<br/>with retry metadata]
    end

    DX -->|"order.*"| Q2
    DX -->|"message.received"| Q1
    DX -->|"payment.succeeded"| Q2
    DX -->|"# .notifications"| Q3
    DX -->|"*.*"| Q4
    DX -->|"cart.abandoned"| Q5

    Q1 -.->|reject w/o requeue ×3| DEX
    Q2 -.-> DEX
    DEX --> QDL
    QDL -->|replay tool| DX
```

### Reliability Semantics
- **Publishers**: Confirm mode ON, mandatory flag, persistent messages
- **Consumers**: Manual ack AFTER successful processing; prefetch=10; idempotent handlers keyed by event_id
- **Retries**: Exponential backoff via retry exchanges (1s → 4s → 16s → DLQ)
- **Poison pills**: After 3 failures → dead letter queue → PagerDuty alert if rate > threshold

## 6. AI Pipeline Data Flow

```mermaid
flowchart TB
    subgraph "Context Assembly (<200ms budget)"
        A1[Conversation history<br/>Redis: last 20 msgs]
        A2[Customer profile<br/>LTV, preferences, segment]
        A3[Relevant products<br/>Pinecone semantic search]
        A4[Store policies<br/>cached in Redis]
    end

    A1 --> AGG[Context Builder]
    A2 --> AGG
    A3 --> AGG
    A4 --> AGG

    AGG --> SC{Semantic cache<br/>similar question recently?}
    SC -->|Hit ≥95% similarity| RES1[Return cached response<br/>~300ms total]
    SC -->|Miss| LLM[Claude 3 streaming call<br/>prompt = system + context + msg]
    LLM --> VAL{Response validation:<br/>PII leak? price correct?}
    VAL -->|Pass| SEND[Send via WhatsApp API]
    VAL -->|Fail| FB[Fallback template response]
    SEND --> CACHE[Write to semantic cache]
    SEND --> LOG[Log token usage,<br/>latency, cost per merchant]
    LOG --> BILL[Billing metering pipeline]
```

**Cost controls:** per-merchant token budgets, daily caps, cheap-model routing (Haiku) for FAQs, expensive models only for complex queries.

## 7. Search Indexing Flow

```
Product created/updated
   → domain event → indexer worker
   → transform to flat doc (denormalize store+category)
   → bulk index to Elasticsearch (refresh: 1s)
   → searchable within ~2s of save
```

Conversations indexed similarly for merchant search ("find chat where customer asked about refund").

## 8. Data Lifecycle & GDPR/NDPR Flows

### Right-to-Erasure (Article 17)
```mermaid
sequenceDiagram
    participant DSU as Data Subject Request
    participant API as Privacy API
    participant Q as erasure.jobs queue
    participant PG as PostgreSQL
    participant S3 as S3
    participant ES as Elasticsearch
    participant PC as Pinecone

    DSU->>API: DELETE /privacy/erase (identity verified)
    API->>PG: Create erasure_request record
    API->>Q: Enqueue cascade job
    Note over Q: SLA: complete within 30 days,<br/>typically <24h
    Q->>PG: Anonymize PII columns (keep financial records)
    Q->>ES: Delete/anonymize docs by customer_id
    Q->>PC: Delete vectors by namespace filter
    Q->>S3: Queue media deletion (lifecycle rule)
    Q->>API: Mark request fulfilled + audit log
```

Financial records are pseudonymized, not deleted (legal retention), with access restricted.

### Data Export (Article 20)
Generates machine-readable ZIP (JSON + CSV) of all customer data, signed URL emailed after identity verification.

## 9. Backup & Recovery Data Flows

| Asset | Method | Frequency | Retention | Restore Drill |
|-------|--------|-----------|-----------|---------------|
| PostgreSQL | WAL archiving + snapshots | Continuous + hourly snaps | PITR 35 days | Quarterly game day |
| Redis | RDB snapshots + AOF | Hourly | 7 days | Not restored (cache rebuild) |
| RabbitMQ | Quorum queues replicate ×3 | Continuous | n/a | Node loss auto-heals |
| S3 | Versioning + cross-region replication | Continuous | 90 days versioned | Monthly sample restore |
| ClickHouse | Distributed backups | Daily | 30 days | Quarterly |

**RPO: 5 minutes (WAL shipping). RTO: 15 minutes (automated runbook).**

## 10. Observability Data Flow

```
Every service → OpenTelemetry SDK
   ├─ Traces (sampled 10%, 100% errors) ──→ Jaeger / Datadog APM
   ├─ Metrics (Prometheus format, 15s scrape) → Mimir/Datadog
   └─ Structured JSON logs (correlation IDs) → Fluent Bit → ELK

Correlation ID propagation:
HTTP header X-Request-ID → AsyncLocalStorage → logs/traces/span tags
WhatsApp message_id becomes trace root for the entire reply pipeline.
```

Alert flow: Metric breach (e.g., ai_response_p99 > 7s for 5m) → Alertmanager → route by severity → PagerDuty (page) / Slack #alerts (warn) → auto-created incident with dashboard links.
