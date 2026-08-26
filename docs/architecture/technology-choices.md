# WCO Technology Choices — Rationale & Alternatives

## Decision Framework

Every choice is scored on: (1) team expertise availability in our hiring markets, (2) total cost at 1M-user scale, (3) ecosystem maturity for African market integrations, (4) operational burden, (5) exit/portability cost.

---

## 1. Monorepo Strategy

### ✅ Chosen: Turborepo + npm workspaces

| Criterion | Turborepo | Nx | Lerna | pnpm workspaces |
|-----------|-----------|----|----|-----------------|
| Remote caching | Free Vercel-hosted or self-host | Paid/complex self-host | None | None native |
| Setup complexity | Low (~zero config) | Medium-high | Low but abandoned-ish | Low |
| Task graph | Content-hash based, excellent | Excellent, more features | Naive | Manual |
| Learning curve | Hours | Days | Hours | Hours |

**Why:** Small platform team (10-15 engs) shipping fast; Turborepo gives 80% of Nx's value with 20% config. Remote cache makes CI 3-5x faster.

**Rejected alternatives:**
- **Nx**: Better generators/distribution rules, but overkill; steeper learning curve slows early velocity.
- **Lerna**: Effectively deprecated post-npm-workspaces era.
- **Multi-repo**: Cross-cutting changes (e.g., shared type change) require 8+ coordinated PRs — unacceptable velocity cost at our size.

---

## 2. Backend Framework

### ✅ Chosen: NestJS 10 + TypeScript

| Criterion | NestJS | Express | Fastify | Go (Gin/Echo) |
|-----------|--------|---------|---------|---------------|
| Structure/architecture | Opinionated modules, DI | Bring-your-own chaos | Minimal | N/A different lang |
| TypeScript first-class | Yes | Community bolt-on | Partial | N/A |
| Hiring pool (Nigeria/Ghana/Kenya) | Large JS/TS pool | Largest | Smaller | Tiny locally |
| Built-in testing, guards, interceptors | Yes | DIY | DIY | DIY |
| Performance ceiling | ~40K RPS/node | Similar | Higher | Highest |

**Why:** Our bottleneck is never raw framework throughput (we scale horizontally); it's development velocity and maintainability across a large domain model (14+ bounded contexts). NestJS's module system maps directly to DDD bounded contexts. Guards/interceptors/pipes give us cross-cutting security without ceremony.

**Rejected alternatives:**
- **Raw Express**: No structure; every team invents its own architecture → inconsistency at scale. Fine as underlying HTTP adapter though.
- **Fastify**: Faster, but we lose the NestJS ecosystem (we can and do run NestJS on Fastify adapter for hot paths).
- **Go microservices**: Superior perf/concurrency, but halves effective hiring pool in Lagos/Accra/Nairobi where our engineering strategy concentrates. Revisit for latency-critical path extraction in Phase 2+ [ADR-002].

---

## 3. Database Layer

### ✅ Chosen: PostgreSQL 15 + Prisma ORM (+ PgBouncer)

**Why PostgreSQL over MySQL:**
- JSONB for flexible product attributes (fashion sellers have wildly varying fields)
- Row-Level Security = defense-in-depth tenant isolation
- Superior indexing (GIN, partial, expression) for our query patterns
- Extensions we rely on: `pg_trgm` (fuzzy search), `PostGIS` (delivery zones), `pgvector` (fallback embeddings)
- Mature logical replication → feeds CDC to ClickHouse/ES without app changes

**Why Prisma over alternatives:**

| Criterion | Prisma | TypeORM | Drizzle | Knex | Raw SQL |
|-----------|--------|---------|---------|------|---------|
| Type safety | Generated, end-to-end | Decorator-based, leaky | Excellent | Weak | Manual |
| Migrations | Deterministic, reviewable | Auto-gen flaky | Good | Good | Manual |
| DevX velocity | Highest | Medium | High | Medium | Lowest |
| Complex query escape hatch | $queryRaw | QueryBuilder | sql`` | Builder | Native |
| Multi-schema support | Yes (15+) | Partial | Yes | Yes | Yes |

**Why:** Merchant-facing CRUD dominates our workload; Prisma's generated types eliminate an entire class of runtime bugs. Escape hatch to `$queryRaw` keeps us unblocked for analytics queries. Schema file = single source of truth reviewed in PRs.

**Rejected alternatives:**
- **MongoDB**: Document flexibility is real, but multi-document transactions + relational integrity (orders→payments→shipments) are exactly our core domain. Eventual consistency semantics dangerous for money movement.
- **DynamoDB**: Infinite scale, but single-table-design complexity tax on a rapidly evolving schema; access patterns must be known upfront — they aren't yet.
- **CockroachDB/YugabyteDB**: Global distribution we don't need yet (single-region AWS af-south-1 + eu-west-1 DR); 2-3x cost premium.
- **TypeORM**: Production incidents with migrations widely reported; decorator metadata limitations.

### Analytics store: ✅ ClickHouse
Dashboard aggregations ("sales by day by store by product") would murder OLTP Postgres. ClickHouse does these 100-1000x faster with columnar compression. Fed via Debezium CDC — zero application code changes.

**Alternatives rejected:** BigQuery (vendor lock + egress costs), Redshift (slower interactive), TimescaleDB (good but narrower than CH for our slice-dice patterns).

---

## 4. Cache & Session Store

### ✅ Chosen: Redis 7 Cluster (ElastiCache)

**Uses:** session store, JWT denylist, rate limiting (sliding window), entity cache-aside, distributed locks (Redlock), BullMQ backing store, semantic cache for AI responses, feature flags.

**Alternatives rejected:**
- **Memcached**: No persistence, no data structures (sorted sets power our leaderboards/rate limiters), no pub/sub.
- **KeyDB/Dragonfly**: Interesting, immature ecosystem; revisit later.
- **Hazelcast/Apache Ignite**: Data-grid complexity unjustified.

---

## 5. Message Queue

### ✅ Chosen: RabbitMQ 3.12 (quorum queues)

| Criterion | RabbitMQ | Kafka | SQS | Redis Streams |
|-----------|----------|-------|-----|---------------|
| Routing flexibility (topic exchanges) | ★★★★★ | Consumer-side filtering | None | Basic |
| Per-message ack/retry/DLQ | Native | Offset-based (coarser) | Native | Consumer groups |
| Operational simplicity @ our scale | High | Kafka = zookeeper/kraft, rebalancing pain | Zero infra | High |
| Ordering per key | Consistent-hash exchange | Partition-native | FIFO queues (limits) | Per-stream |
| Cost @ 50K msg/s | Self-managed m6g.xlarge ×3 ≈ $600/mo | MSK ≈ $2K+/mo | ~$1K/mo + hidden costs | Cheap but fragile |

**Why:** Our workload is task-queue shaped (webhook → work → ack), not log-replay shaped. RabbitMQ's routing topology (topic exchange `domain.events` with pattern bindings) models our event-driven architecture perfectly. DLQ + retry-exchange pattern is battle-tested.

**When we'd switch to Kafka:** >500K msg/s sustained, need for stream replay/event sourcing audit log, or complex multi-consumer fan-out with independent offsets. Trigger documented in [ADR-004].

**SQS rejected:** Vendor lock-in acceptable trade for zero ops, BUT routing/filtering gaps force app-level fan-out logic; FIFO queue throughput caps hurt cart-burst scenarios.

---

## 6. Frontend Stack

### ✅ Chosen: Next.js 14 (App Router) + React 18 + Tailwind CSS + Zustand + TanStack Query

| Choice | Why | Rejected alternative & why |
|--------|-----|---------------------------|
| **Next.js 14 App Router** | RSC cuts client JS ~40%; merchant dashboards benefit from server-fetched shells + streamed islands; PWA export for flaky African connectivity | **Vite SPA** — worse SEO for public catalog pages, no SSR for link previews when merchants share storefront links on WhatsApp (critical acquisition channel!) |
| **Tailwind CSS** | Design-token consistency, tiny purged bundles (~10KB gz), zero runtime CSS-in-JS cost | **MUI/styled-components** — runtime overhead, bundle bloat, theming fights |
| **Zustand** | 1KB, no boilerplate, perfect for cross-component UI state (sidebar, modals, theme) | **Redux Toolkit** — ceremony without payoff once TanStack Query owns server state |
| **TanStack Query v5** | Cache, deduping, optimistic updates, offline mutations (mobile!) | **SWR** — less mature devtools/mutation story |
| **React Hook Form + Zod** | Uncontrolled-perf forms (merchant uploads 50-product CSV forms); Zod schemas shared with backend via `@wco/shared` | **Formik** — re-render heavy |
| **shadcn/ui** (via @wco/ui) | Copy-paste ownership, Radix accessibility primitives, Tailwind-native | **MUI/Ant** — styling battles, bundle weight |
| **Recharts + Tremor** | Dashboard charts tuned for React | **Chart.js** — imperative API friction |

**Connectivity-first design note:** Target users are on 3G/unstable networks in Lagos traffic. Next.js SSR + aggressive Cloudflare caching + service worker = usable dashboard offline for read paths.

---

## 7. Mobile Stack

### ✅ Chosen: Expo SDK 50 / React Native 0.73

**Why RN over Flutter:**
- Shared language + packages (`@wco/shared`, Zod validators) with web team
- Nigerian mobile market: Android ~85%; RN Android perf adequate for our form/list-heavy app
- OTA updates via EAS Update = critical for fixing bugs without Play Store review delays
- Larger local hiring pool

**Flutter rejected:** Better perf/animations (we don't need them), Dart = separate talent pool + duplicated validation logic.

**Native rejected:** 2x teams, 2x cost.

**Expo specifically:** Managed workflow removes Xcode/Android Studio hell; EAS Build handles signing; secure-store for tokens; push notifications solved.

---

## 8. AI Engine

### ✅ Chosen: Node.js/TypeScript service + Claude 3 primary + GPT-4 fallback + Pinecone vectors

| Decision | Rationale |
|----------|-----------|
| **Claude 3 Opus primary** | Best instruction-following for Yoruba/Hausa/Swahili pidgin mixing; long context (200K) fits full conversation history; strong refusal behavior reduces hallucinated prices |
| **GPT-4 Turbo fallback** | Provider redundancy; competitive quality; different failure modes |
| **Claude Haiku for FAQs** | 60x cheaper than Opus; handles "price of X?" tier queries; routing classifier decides tier |
| **Pinecone** | Managed, p95 <100ms similarity search, namespaces-per-store isolation, zero ops | 
| **LangChain-lite (custom)** | We use prompt templates + function calling directly; LangChain abstractions add debugging friction for our narrow use cases |

**Python/FastAPI rejected for AI service:** Team is TS-uniform; Claude/OpenAI SDKs are equally good in TS; GPU inference not needed initially (API-based models). If fine-tuned open models arrive (Llama 3 on our data), extract Python/Triton service then [ADR-009].

**Self-hosted open models rejected (for now):** Quality gap on code-switched Nigerian Pidgin unacceptable for flagship feature; GPU fleet = new ops surface area. Revisit at 100K+ merchants when volume justifies fine-tune economics (est. break-even analysis in ADR-009).

---

## 9. Payments Integration

### ✅ Chosen: Adapter pattern over Paystack (primary NG/GH) + Flutterwave (multi-country) + OPay (NG mobile-money heavy)

| Provider | Strengths | Role |
|----------|-----------|------|
| **Paystack** (Stripe-owned) | Best-in-class API reliability (99.99%), excellent webhook design, cards+bank transfer+USSD | Primary Nigeria/Ghana |
| **Flutterwave** | Widest African coverage (34 countries), strong Kenya/Uganda | Expansion markets |
| **OPay** | Massive mobile wallet penetration in NG informal sector | Wallet-heavy merchants |

All wrapped behind `PaymentProvider` interface → circuit breaker → automatic failover chain per transaction type. Webhooks normalized into canonical `payment.succeeded` domain events.

**Stripe rejected:** Doesn't process NG naira locally; card-only focus misses bank-transfer/USSD flows that dominate informal commerce.

## 10. WhatsApp Integration

### ✅ Chosen: Meta Cloud API direct (primary) + Twilio (secondary)

- **Meta Cloud API**: Cheapest (no middleman markup), official, fastest new features
- **Twilio**: Battle-tested webhooks, superior docs/debugging, useful for initial launch speed while Meta app review pending
- Abstraction layer `WhatsAppProvider` so merchants can be migrated between backends transparently
- 360dialog evaluated: reseller positioning adds margin without capability we lack

## 11. Infrastructure & Platform

| Layer | Choice | Key reason | Rejected |
|-------|--------|------------|----------|
| Cloud | **AWS** | Deepest af-south-1 (Cape Town) region presence, EKS maturity, credits program for startups | GCP (weaker Africa region story), Azure (enterprise-oriented sales motion) |
| Compute | **EKS (Kubernetes)** | Standardized deploy target across all services; KEDA autoscaling on queue depth; portability insurance | ECS (AWS lock-in), EC2 ASGs (manual orchestration), Fargate-only (cost @ steady state) |
| IaC | **Terraform** | Industry standard, module registry, state management | Pulumi (TS-native appeal but smaller ecosystem), CDK (lock-in) |
| Helm | Charts for app deployments | Versioned releases, rollback | Raw kustomize only |
| GitOps | **ArgoCD** | Declarative sync, drift detection, audit trail | Flux (parity), manual kubectl (nope) |
| CDN/WAF | **Cloudflare** | PoPs in Lagos/Nairobi (real latency win for target users!), WAF, DDoS, R2 for image offload | CloudFront (fewer African PoPs historically) |
| Object storage | **S3** | Durability, lifecycle policies, presigned URLs | Cloudflare R2 (used for egress-heavy public assets instead — zero egress fees) |

## 12. Observability Stack

| Concern | Tool | Why | Alternative considered |
|---------|------|-----|----------------------|
| APM/Metrics | **Datadog** | Fastest time-to-insight, unified tracing+logs+RUM, startup credits cover year one | Prometheus+Grafana (kept for infra metrics & cost control), New Relic |
| Errors | **Sentry** | Best-in-class grouping, source maps, release health | Rollbar, Bugsnag |
| Logs | ELK (self-hosted on EKS) + Fluent Bit | Cost at our log volume vs Datadog per-GB pricing | Datadog logs ($$$ at 500GB/day) |
| Traces | OpenTelemetry SDK → Datadog backend | Vendor-neutral instrumentation = exit optionality | OpenZipkin (dated), X-Ray (lock-in) |
| Uptime | Checkly | Playwright-scripted checks from African regions | Pingdom |

**Philosophy:** OTel everywhere means we're never trapped. Datadog is rented insight, not owned infrastructure.

## 13. Testing Stack

| Type | Tool | Why |
|------|------|-----|
| Unit/Integration (BE) | Jest + Testcontainers | Real PG/Redis/RabbitMQ in integration tests — no mock-theory bugs |
| Unit (FE) | Vitest | Faster, ESM-native, better DX vs Jest |
| Component | React Testing Library | User-centric queries |
| E2E (Web) | Playwright | Multi-browser, traces, parallelism, codegen | 
| E2E (Mobile) | Maestro | YAML flows, resilient to UI churn, CI-friendly vs Detox flakiness |
| Contract | Pact | Prevents frontend/backend integration surprises |
| Load | k6 | Scriptable in TS, cloud + local, cheap |
| Mutation | StrykerJS | Quarterly on payment/pricing modules — validates test *quality* |

## 14. Summary Table — Full Stack

```
┌────────────────────────────────────────────────────────────┐
│ FRONTEND   Next.js 14 · React 18 · Tailwind · Zustand      │
│            TanStack Query · RHF+Zod · shadcn/ui · Recharts │
│ MOBILE     React Native 0.73 · Expo 50 · MMKV · Reanimated │
│ BACKEND    NestJS 10 · TypeScript 5.3 · Fastify adapter    │
│ DATA       PostgreSQL 15 (Prisma) · Redis 7 · ClickHouse   │
│            Elasticsearch · Pinecone · S3/R2                │
│ MESSAGING  RabbitMQ 3.12 (quorum) · BullMQ · WebSocket     │
│ AI         Claude 3 (Opus/Haiku) · GPT-4 Turbo · pgvector  │
│ INTEGRATE  Meta Cloud API · Twilio · Paystack              │
│            Flutterwave · OPay · GIG · Kwik · Sendy         │
│ INFRA      AWS af-south-1 · EKS · Terraform · Helm·ArgoCD  │
│            Cloudflare · PgBouncer · KEDA                   │
│ OBSERVE    Datadog · Sentry · OTel · ELK · Checkly         │
│ CI/CD      GitHub Actions · Trunk-based · Turborepo cache  │
└────────────────────────────────────────────────────────────┘
```

Every decision has a documented ADR with revisit triggers. Technology is chosen for the problem at today's scale, with explicit, pre-planned migration paths for tomorrow's.
