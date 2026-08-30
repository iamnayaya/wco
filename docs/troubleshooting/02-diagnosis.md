# How to Diagnose Issues

Structured approach to investigating a support ticket from an unknown cause to a resolution. Diagnostics tools available to support/ops: Kibana (logs), Grafana (metrics), Datadog, Sentry, RabbitMQ UI.

> **Support agents:** you have read access to logs/observability. For anything touching payment security or suspected data issues, never diagnose alone — involve ops/security ([Escalation](./04-escalation.md)).

## 1. Collect the essential facts (the minimum)

Ask for / note:
- **Account & store** (id/email, store name).
- **What they did** (exact steps, device, web or mobile).
- **What they expected** vs **what happened**.
- **Error message / `requestId` / screenshots.**

The `requestId` is the single most useful field — it correlates logs + trace for a single request.

## 2. The diagnosis flow

```mermaid
flowchart TD
    A[Ticket arrives] --> B{Status page shows outage?}
    B -->|Yes| C[Point to status + incident]
    B -->|No| D[Collect facts + requestId]
    D --> E{Client-side (browser/app/network)?}
    E -->|Yes| F[Resolve config/cache/connectivity]
    E -->|No| G{Server-side? search logs by requestId}
    G --> H[Identify failing service/span in trace]
    H --> I{Classify error}
    I --> J[Validation/config in app]
    I --> K[Dependency / provider (payments, WhatsApp, logistics)]
    I --> L[Infra (DB, cache, queue, network)]
    J --> Resolve[Resolve per Resolution guide]
    K --> Resolve
    L --> Resolve
```

## 3. Using the diagnostic tools

### Logs (Kibana)
- Search by `requestId`, `storeId`, service, or timestamp.
- Look for ERROR/WARN lines around the failure window.

```
kibana query:  requestId: "req_01HQ..."   or   storeId: "str_123" and level: error
```

### Metrics (Grafana / Datadog)
- Check latency/error/saturation for the service at the incident window.
- Compare to baseline — is this a burst or a trend?

### Traces (Jaeger)
- Find the slow/failing span → which service/dependency?

### Errors (Sentry)
- Recent stack traces for the affected service.

### Queues (RabbitMQ)
- Backlog / dead-letter growth → consumer issues or poison messages ([Queue runbook](../runbooks/10-queue-runbook.md)).

## 4. Classify the error

| Class | Indicators | Likely resolution path |
|---|---|---|
| **Client / config** | browser/app/network, user account settings | guide user to fix config/cache |
| **App logic / validation** | 4xx, known error code | fix data/config in dashboard; or raise to QA if a real bug |
| **Dependency / provider** | provider outages, webhook delays | check provider status, retry; escalate to ops if provider bug |
| **Infrastructure** | 5xx, latency, queue backlog | ops / on-call via runbook |

## 5. When you can't diagnose
- Recreate the issue on staging (with synthetic data) if you can reproduce.
- If not reproducible from a ticket alone, ask for a Loom/screen recording + exact steps + `requestId`.
- If you've spent > 30 min without a hypothesis → follow [Escalation](./04-escalation.md). Don't spin.

## 6. Record what you learned
- Every diagnosis that produced a fix → add a case to [Common issues](./01-common-issues.md) or [Known issues](./05-known-issues.md) so the next agent is faster.
