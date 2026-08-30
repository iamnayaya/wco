# Onboarding — Resources

A curated index of the tools, links, and docs you'll use daily at WCO.

## Core documentation

| Resource | Where |
|---|---|
| Docs root / landing | [`docs/README.md`](../README.md) |
| Developer docs | [`docs/developer/`](../developer/README.md) |
| API docs | [`docs/api/README.md`](../api/README.md) |
| Database docs | [`docs/database/README.md`](../database/README.md) |
| Architecture & ADRs | [`docs/architecture/`](../architecture/README.md) + [`docs/adr/`](../adr/) |
| QA & release | [`docs/qa/README.md`](../qa/README.md) |
| Runbooks | [`docs/runbooks/README.md`](../runbooks/README.md) |
| Playbooks | [`docs/playbooks/README.md`](../playbooks/README.md) |
| Security | [`docs/security/README.md`](../security/README.md) |
| Compliance | [`docs/compliance/README.md`](../compliance/README.md) |

## Tools & access

| Tool | Access |
|---|---|
| **Code / Git** | GitHub; clone `anomalyco/wco` |
| **CI/CD** | GitHub Actions; deploys via ArgoCD |
| **Cloud** | AWS console (read-only, or break-glass with audit) |
| **Monitoring** | Grafana, Datadog, Kibana (logs), Sentry (errors), Jaeger (traces) |
| **Messaging** | PM/PSP + WhatsApp sandboxes via `.env` |
| **Queue** | RabbitMQ UI localhost:15672 |
| **Docs** | this repo (`docs/`) — Docusaurus-rendered |
| **Notion** | on-call schedule, RFC templates, internal SOPs |

## Chat channels

- `#general`, `#announcements` — company & news
- `#wco-frontend`, `#wco-backend`, `#wco-ai`, `#wco-infra` — squads
- `#incidents`, `#oncall` — paging & incidents
- `#docs` — documentation ownership/feedback

## Key commands

```bash
npm run dev              # full stack (turbo watch)
npm run test             # all tests
npm run lint && npm run typecheck
npm run docker:up        # infra containers
npm run db:migrate && npm run db:seed
k6 run infra/qa/k6/buyer-journey.js   # load test
```

## Where code lives

```
apps/        backend · frontend · mobile · ai-engine · webhook-handler · admin-dashboard
packages/    shared · ui · config · database · auth · payments · logistics · analytics · messaging · testing
tools/       generators · scripts · cli · migration · benchmark
infra/       kubernetes · terraform · docker · helm · monitoring · security · qa
docs/        this documentation
```

## Onboarding friction log
If something about onboarding (or any tool) was harder than it should be, log it in `docs/onboarding/friction-log.md` — every complaint becomes a platform ticket. This is how we keep building a smooth experience for the next 100 engineers.

## Still lost?
Your buddy, squad tech lead, or the `#general` channel. Welcome to WCO — go build something people love. 🚀
