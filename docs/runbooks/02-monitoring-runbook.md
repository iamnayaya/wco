# Runbook: Monitoring

Investigating metrics, logs, tweets, and alerts; tuning alerts without noise.

## Prerequisites
- Access to Grafana, Kibana (ELK), Datadog, Sentry, and Jaeger (SSO).
- Alertmanager + PagerDuty access.
- The correlation `requestId` convention (see [Monitoring & logging guide](../developer/10-monitoring-logging-guide.md)).

## Key views

| Question | Where |
|---|---|
| Is a service up/fast/erroring? | Grafana dashboards (`infra/monitoring/prometheus`) |
| What happened at time T? | Kibana (structured logs, filter by `ts` + `requestId`) |
| Where did the time go? | Jaeger (OpenTelemetry traces) |
| What exceptions are firing? | Sentry |
| High-level multi-service? | Datadog |

## Investigating an alert or slowdown

1. **Read the alert annotation** — it links to the relevant runbook.
2. **Identify the service + window.** Is it one service or many? Start when?
3. **Pull the golden signals** for that service: latency (p50/p95/p99), error rate, saturation (CPU/conn pool/queue depth).
4. **Find a sample `requestId`** (from the alert, a log line, or a user report).
5. **Trace it in Jaeger** → find the slow/failing span + dependency.
6. **Check dependencies:** Postgres (fast queries? locks? connections?), Redis (hit rate, evictions), RabbitMQ (backlog/dead letters), external PSPs/WhatsApp.
7. **Decision:** escalate to an incident (if users impacted) or fix as routine work.

## Common signal patterns & meaning

| Signal | Pattern | Likely cause |
|---|---|---|
| Latency ↑ with errors ↑ | High 5xx, slow | dependency down / saturation |
| Latency ↑, errors flat | Slow queries, GC, lock contention | DB query regression, index missing |
| Saturation alone | CPU/mem high, 200s slow | scale up → [Scaling runbook](./05-scaling-runbook.md) |
| Queue depth ↑ | slow consumer | consumer down or slow; check logs |
| Error 429 spike | clients throttled | rate-limit config / burst |
| Dead-letter ↑ | poison messages | bug in consumer → [Queue runbook](./10-queue-runbook.md) |

## Adding / tuning an alert

Alert rules live in `infra/monitoring/prometheus` (PrometheusRule CRs). To add or tune:

1. Edit the rule (e.g., `alert: HighOrderErrorRate`, expr, `for:`, severity).
2. Add an annotation: `runbook_url` pointing to the right runbook.
3. Open a PR; merge via the normal workflow.
4. Verify the alert fires/closes on a test pod on dev.

Rules: alert only what's actionable. Two signal classes:
- **Page-worthy (SEV1/2):** SLO burn > 2x, availability breach, data loss, money loss.
- **Ticket-worthy (SEV3):** P95 jitter, elevated errors not breaking SLO.

## Uptime / synthetic monitors
- Datadog browser checks exercise critical journeys; alert on availability + perf regression.
- Confirm synthetic monitors are green post-deploy.

## SLO review
- Monthly ops review: error budget, SLO burn, flaky test debt, cost anomalies → [Ops review activity](../guides/development-workflow.md#9-engineering-rituals).

## Escalation
- Users affected or SLO burning → [Incident response runbook](./03-incident-response-runbook.md).
- Otherwise, file/patch per [QA defect process](../qa/process.md).
