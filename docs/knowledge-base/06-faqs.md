# Knowledge Base: Team & Technical FAQs

Answers to the questions engineers ask most. (Merchant-facing FAQs live in [`docs/user/07-faq.md`](../user/07-faq.md).)

## Technical

**Q: Why don't I publish to the queue directly?**
Events must be emitted as outbox rows in the same DB transaction, then relayed ([ADR-002](../adr/ADR-002-transactional-outbox.md)). Direct publishing can lose messages on crash between commit and publish.

**Q: How is multi-tenancy enforced?**
Application-level `TenantContext` scoping of every query by `storeId`, with Postgres RLS as a database backstop ([ADR-003](../adr/ADR-003-multi-tenancy.md)).

**Q: What port/workspace do I run for X?**

| App | Port |
|---|---|
| Frontend | 3000 |
| Backend API | 4000 |
| Admin | 3001 |
| AI engine | 5000 |

**Q: Why cursor pagination over offset/limit?**
Stable and consistent under concurrent writes ([design guidelines](../api/design-guidelines.md)).

**Q: Why is money a string, not a float?**
Float math causes rounding errors in pricing/payouts. Money is `Decimal` in DB, strings at the API edge.

**Q: My migration failed to deploy.**
It was likely not backward-compatible. Follow the expand-migrate-contract + two-release rule ([Deployment guide](../developer/09-deployment-guide.md#database-migrations)).

**Q: Where is the SDK for the API?**
See [SDK libraries](../api/sdk-libraries.md). If none suits, generate from `openapi.yaml`.

## Process

**Q: What's the Definition of Done?**
See [Team processes](../onboarding/08-team-processes.md) — code+tests, integration tests, contract, lint/typecheck, docs, observability, security checklist.

**Q: How do I trigger a deploy?**
Merge a green PR to the right branch. Prod requires approval/gate; deploys are automated via ArgoCD ([Deployment guide](../onboarding/06-deployment-guide.md)).

**Q: What do I do if I find a security issue?**
Follow [SECURITY.md](../../SECURITY.md) / the [Security playbook](../playbooks/06-security-incident-playbook.md). Report privately to the security channel — no public disclosure; expect a rotate-if-necessary outcome.

**Q: What's an ADR and when do I write one?**
A record of a significant decision. Write one for non-trivial, hard-to-reverse choices ([ADRs](../adr/)). Discuss at arch review.

**Q: Where do runbooks vs playbooks differ?**
Runbooks = exact commands/procedures([runbooks](../runbooks/README.md)); playbooks = judgment/ownership flows ([playbooks](../playbooks/README.md)).

## Ops

**Q: What do the SLOs mean?** Uptime/SLO and incident severities are in the [Incident management playbook](../playbooks/01-incident-management-playbook.md).

**Q: How do I do a restore drill?** [Backup runbook](../runbooks/04-backup-recovery-runbook.md) — monthly.

**Q: What are our DR targets?** RTO ≤ 60 min, RPO ≤ 15 min for full region loss; DR region eu-west-1 ([DR runbook](../runbooks/dr.md)).

**Q: How do I rotate my local `.env` safely?** Follow the dual-write rotation procedure ([Security runbook](../runbooks/07-security-runbook.md#1-secret-rotation)).

## Adding FAQs
If a question recurs, add it here with a one-line answer and a canonical link. Keep it scannable.
