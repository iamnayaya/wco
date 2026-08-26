# Observability

> You cannot page on what you cannot see. Every request emits structured logs,
> metrics, and traces bound together by `X-Request-ID` / W3C `traceparent`.

---

## 1. The three signals

| Signal | Stack | Retention |
|---|---|---|
| Logs | pino (JSON) → stdout → Vector/Loki → Grafana | 30 d hot · 1 y cold (S3) |
| Metrics | prom-client → Prometheus → Grafana + alertmanager | 15 s res, 13 mo |
| Traces | OpenTelemetry SDK → OTel Collector → Tempo/Jaeger | 14 d |

Correlation keys present in **all three**: `requestId`, `traceId`, `storeId`,
`merchantId`, `userId` (never email/PII as labels — cardinality + privacy).

## 2. Structured logging contract

One line per request + one per significant domain event. Shape:

```json
{
  "level": "info",
  "time": "2026-02-01T12:00:00.123Z",
  "service": "backend-api",
  "version": "1.0.0+8f14e2a",
  "requestId": "req_01HQ...",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "method": "POST", "route": "/api/v1/orders", "status": 201,
  "durationMs": 182,
  "storeId": "str_...", "userId": "usr_...",
  "msg": "request completed"
}
```

Rules: no PII beyond ids; secrets redacted centrally (security.md §9); level WARN for
retried provider calls, ERROR only when human action or paging results; log volume
budget per pod enforced (sampling at DEBUG in prod).

## 3. RED + USE metrics

Per route (auto-instrumented via interceptor, label `route` normalized — no raw ids):

```
wco_http_requests_total{service,route,method,status_class}
wco_http_request_duration_seconds{service,route}   // histogram
wco_http_requests_inflight{service}
```

Plus domain counters that matter to the business:

```
wco_ai_replies_total{store_tier,outcome=auto|escalated|failed}
wco_ai_latency_seconds          wco_payment_webhooks_total{provider,outcome}
wco_outbox_lag_messages         wco_delivery_quotes_total{carrier}
wco_rate_limit_hits_total{tier} wco_idempotency_replays_total
```

USE for infrastructure: DB pool saturation, Redis command latency, RabbitMQ queue depth,
pod CPU/throttle — all in the standard Grafana folder `WCO/API Golden`.

## 4. Tracing (OpenTelemetry)

- Auto-instr: HTTP (Fastify plugin), Prisma (`@prisma/instrumentation`), ioredis,
  amqplib; manual spans around gRPC ai-engine calls and PSP adapters.
- Context propagates via `traceparent`; gateway starts root span with `X-Request-ID`
  as span attribute; webhook-handler continues traces started by providers where
  possible (Meta forwards none — new root keyed by event id).
- Sampling: parent-based, 10% baseline; 100% for 5xx and routes tagged `critical`.
- Exemplars link Prometheus histogram buckets ↔ example traces.

## 5. SLOs & alerting

| SLI | SLO | Alert (page) | Ticket |
|---|---|---|---|
| Availability (non-4xx, gateway) | 99.9% / 30 d | burn 14× over 1 h | burn 6× over 6 h |
| Read latency p99 ≤ 400 ms | 99% of mins | burn rule | — |
| Write latency p99 ≤ 800 ms | 99% | burn rule | — |
| Webhook ingest success ≥ 99.5% | 30 d | < 99% over 10 min | trend |
| Outbox relay lag | ≤ 5 s p95 | > 60 s | > 10 s |
| AI first-reply ≤ 5 s | 95% | < 90% hourly | trend |

Alert routing: PagerDuty (sev1/sev2) ← alertmanager rules in
`infra/monitoring/alertmanager/`; every page links the canonical runbook URL.
Error-budget policy: budget exhausted ⇒ feature freeze until burn recovers.

## 6. Dashboards (Grafana folders)

1. **API Golden** — RED per route class, top slowest routes, rate-limit hits.
2. **Tenancy** — requests/errors by store tier, noisiest merchants, RLS denials.
3. **Payments** — PSP success funnel, webhook lag, refund velocity anomalies.
4. **AI** — reply latency distribution, escalation rate, token spend/day vs budgets.
5. **Data pipeline** — outbox lag, rollup freshness, partition pre-create status.

## 7. Incident hooks

- `/status` exposes machine-readable component health for statuspage sync.
- Every 5xx response includes `requestId` → support paste → trace + logs in one click
  (Tempo search by `requestId` attribute).
- Deploy markers annotate Grafana automatically (CI webhook), making regressions obvious.
