# Monitoring & Logging Guide

Observability is built into every service. This guide explains the "golden signals" we track, where to look for logs, how to use traces, and how to debug production issues. Detailed operational steps are in the [Monitoring runbook](../runbooks/02-monitoring-runbook.md).

## The three pillars

| Pillar | Tooling | What it answers |
|---|---|---|
| **Metrics** | Prometheus + Grafana | "Is it fast / available?" |
| **Logs** | ELK (Elasticsearch, Logstash, Kibana) + S3 archive | "What happened?" |
| **Traces** | OpenTelemetry + Jaeger | "Where did the time go?" |

Plus:
- **Error tracking**: Sentry (exceptions, stack traces, release health)
- **APM / synthetic**: Datadog (uptime monitors, browser checks)
- **Alerting**: Alertmanager → PagerDuty (#on-call)

## Golden signals

For every service we track:

1. **Latency** — p50/p95/p99 request latency.
2. **Traffic** — requests/sec, per route, per tenant cluster.
3. **Errors** — HTTP 5xx rate, exception rate, dead-letter queue depth.
4. **Saturation** — CPU, memory, connection pool usage, queue depth.

### SLOs (examples)

| Signal | SLO |
|---|---|
| API availability | 99.9% |
| API latency | p95 < 500ms; core reads p95 < 200ms |
| AI reply latency | p95 < 8s (aim ~5s) |
| Webhook delivery | ≥99.9% delivered within 5 min |
| Error rate | < 1% of requests |
| Crash-free (mobile) | ≥ 99.8% sessions |

## Structured logging

All services log **structured JSON** to stdout; the collector ships it to Elasticsearch.

```json
{ "level": "info", "ts": "2026-08-29T12:00:00Z", "msg": "order created",
  "service": "backend", "requestId": "req_abc", "storeId": "str_123",
  "orderId": "ord_456", "amount": "1500.50", "currency": "NGN", "latencyMs": 42 }
```

### Logging rules

- **JSON structured logs only** — no ad-hoc `console.log` in production code.
- **Never** log secrets, tokens, PII, passwords, or full card numbers.
- Include `requestId` (correlation ID) in every log line and trace.
- Include tenant `storeId` where relevant for tenant-level triage.

Look for the correlation `requestId` first — it ties together logs, the trace, and any error report.

## Instrumenting new code

When you add an endpoint or job, you're expected to add:

1. **Metrics**: request counter + latency histogram + error counter (Prometheus).
2. **Structured logs**: on operation start/end + errors.
3. **Trace spans**: OpenTelemetry span for the operation, parented to incoming request.

Follow the existing patterns in `packages/observability` (or the service's `observability` module).

## Debugging a production issue

1. **Start the clock.** Severity + escalation per [Incident management playbook](../playbooks/01-incident-management-playbook.md).
2. **Find the `requestId`** from the user's report or error alert.
3. **Grep Kibana** for that `requestId` → trace the full journey.
4. **Open the Jaeger trace** → see which service/span took the time or failed.
5. **Check dashboards** → any latency/error/saturation anomaly at that time window?
6. **Check queue depth** → is the inbox/outbox backlogged?
7. **Check Sentry** → recent stack traces for the affected service.
8. Document findings in the incident log; update runbooks if the runbook missed it.

### Key dashboards

| Dashboard | Where |
|---|---|
| Service latency/errors/saturation | Grafana (`infra/monitoring/prometheus` + `grafana`) |
| Multi-service overview | Datadog |
| Error / exception stream | Sentry |
| Log explorer | Kibana |
| Deployment health | ArgoCD UI + Argo Rollouts |

## Alerting

- **Alertmanager** converts Prometheus alert rules into PagerDuty pages.
- Alert rules live in `infra/monitoring/prometheus`.
- Every alert annotation links to the relevant **runbook** so the on-call engineer knows exactly what to do.
- Severity model per [QA severity & SLAs](../qa/README.md#severity--slas).

## Synthetic monitoring

- Datadog browser checks exercise critical user journeys (login, catalog browse, checkout) every few minutes.
- They alert on availability and performance regressions **before** real users hit them.

Next: [Troubleshooting guide](./11-troubleshooting-guide.md).
