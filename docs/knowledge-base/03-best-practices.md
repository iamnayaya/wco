# Knowledge Base: Best Practices

The practices that reliably work at WCO, distilled from experience. Organized by discipline.

## Development best practices

1. **Trunk-based with short branches** — merge small often; feature flags for incomplete work. → [Git workflow](../developer/06-git-workflow.md)
2. **Tests at the right layer** — unit first, integration with real containers, E2E for critical journeys. → [Testing guide](../developer/08-testing-guide.md)
3. **API-first** — define/agree contracts before implementation; `openapi.yaml` is source of truth.
4. **Idempotency on unsafe ops** — use `X-Idempotency-Key` ([API guidelines](../api/design-guidelines.md#7-idempotency)).
5. **Cursor pagination** — stable under writes.
6. **Money as strings** — never floats; `Prisma.Decimal` in DB.
7. **Observability from day one** — metrics + structured logs + trace spans on every new endpoint/job.
8. **Emit events, don't publish directly** — outbox pattern ([ADR-002](../adr/ADR-002-transactional-outbox.md)).
9. **Least privilege** — roles and permissions grant the minimum.

## Operations best practices

1. **Backward-compatible migrations** — expand-migrate-contract; two-release rule for breaking.
2. **Automated deploys with canary** — roll forward / roll back safely ([Deployment runbook](../runbooks/01-deployment-runbook.md)).
3. **Everything as code** — IaC (Terraform/Helm) and dashboards/alerts as config.
4. **Monitor golden signals** — latency, traffic, errors, saturation ([Monitoring runbook](../runbooks/02-monitoring-runbook.md)).
5. **Backup + restore drills** — test restore monthly, not just backups ([Backup runbook](../runbooks/04-backup-recovery-runbook.md)).
6. **Cache/queue discipline** — prefix-scoped flushes; never blind `FLUSHALL`/purges ([Cache](../runbooks/09-cache-runbook.md) / [Queue](../runbooks/10-queue-runbook.md)).

## Security best practices

1. **Treat secrets as restricted** — never in Git; rotate with dual-write.
2. **Fail closed** — on doubt (signature, permission, tenancy), deny.
3. **Validate at all boundaries** — inputs, outputs, webhook signatures.
4. **Keep card data out** — hosted/tokenized checkout only.
5. **Blame-free incidents** — focus on systems and learning ([Post-mortem playbook](../playbooks/03-post-mortem-playbook.md)).

## Documentation best practices

- **Docs-as-code** in this repo; version-locked to the code ([Platform setup](../platform-style/01-platform-setup.md)).
- **Single source of truth** — OpenAPI spec, README, ADRs; link rather than duplicate.
- **Keep it actionable** — runbooks give exact commands; playbooks give judgment.
- Follow the [Style guide](../platform-style/02-style-guide.md).

## Product/UX best practices (for merchants)

- Keep catalogs current so AI answers are accurate ([Tips & tricks](../user/tips-and-tricks.md)).
- Turn on 2FA; invite staff with least-privilege roles ([Settings guide](../user/guides/settings-guide.md)).
- Market with opt-in consent and an opt-out ([Customers guide](../user/guides/customers-guide.md)).

## Reviewing your own habits
- **Definition of Done** is your checklist — use it on every story ([Team processes](../onboarding/08-team-processes.md)).
- Add a lesson here when you learn one; keep this doc current.
