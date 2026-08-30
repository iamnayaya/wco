# Knowledge Base: How-To Guides

Task-oriented procedures for common engineering and operational tasks. Each links to deeper docs.

## How to add a new backend endpoint

1. Follow the API-first flow: add the operation to `docs/api/openapi.yaml` (must pass the `oasdiff` gate, no breaking changes within `v1`).
2. Create the DTO with `class-validator` (whitelist mode), the repository method, and the service + controller in the relevant module (`apps/backend/src/modules/<module>`).
3. Scope tenant data by `storeId` from `TenantContext` ([ADR-003](../adr/ADR-003-multi-tenancy.md)).
4. Add auth via the RBAC guard (AGENT/ADMIN/OWNER as appropriate).
5. Declare the rate-limit tier for the route ([API guidelines](../api/design-guidelines.md#12-rate-limit-tiers)).
6. Add observability: metrics, structured logs, trace span.
7. Write unit + integration tests; update contract tests (Pact) if the surface changed.
8. Update docs and the endpoint matrix; PR per [Code review guide](../onboarding/04-code-review-guide.md).

## How to add a new product field end-to-end

1. Model change in `packages/database` schema (Prisma) → **additive** migration (backward-compatible).
2. Update DTOs/validation in backend, the API spec, and the frontend UI (`apps/frontend/src`).
3. Consider the AI: if the field should inform answers, wire it into the store AI context.
4. Add a **feature flag** if user-facing and incomplete.
5. Migrate up + down locally; test; ship per [Deployment guide](../developer/09-deployment-guide.md).

## How to rotate a secret

Follow the **dual-write** procedure in the [Security runbook](../runbooks/07-security-runbook.md#1-secret-rotation). Never change a secret to a single new value without a transition window — it causes outages.

## How to investigate a slow API call

1. Get the `requestId` and open the [Monitoring guide](../developer/10-monitoring-logging-guide.md) flow.
2. Find the slow/failing span in Jaeger.
3. Check for a missing index / N+1 ([Database runbook](../runbooks/08-database-runbook.md)).
4. Check cache hit rate and queue depth.

## How to run a database migration safely

1. Use a **backward-compatible** (additive) migration.
2. `npm run db:migrate` locally; test **up and down**.
3. Deploy per the migration window ([Deployment runbook](../runbooks/01-deployment-runbook.md)) — runs before new pods.
4. For breaking changes, split into two releases (expand-migrate-contract).

## How to add a new webhook event

1. Define the event schema + add it to the [webhooks doc](../api/webhooks.md).
2. Emit the event via the outbox on the relevant state change ([ADR-002](../adr/ADR-002-transactional-outbox.md)).
3. Add subscription options in `POST /webhooks`.
4. Test with `POST /webhooks/:id/test`.
5. Document the payload + example.

## How to add a new analytics metric

1. Decide the metric + its KPI meaning ([Analytics user guide](../user/guides/analytics-guide.md)).
2. Emit/aggregate server-side; add to the `analytics` module.
3. Expose via the analytics API; add to the dashboard chart.
4. Track against SLO/cost if relevant.

## How to add a new AI response template

1. Store AI config: add the template under `ai-configs/responses*` (OWNER/ADMIN).
2. Use placeholder tokens (e.g., `{{customer_name}}`, `{{product_list}}`).
3. Test with `POST /ai-configs/test` (rate-limited).
4. See the [Messages/AI guide](../user/guides/messages-guide.md) for template best practices.

## How to handle a customer data-subject request (DSR)

Follow the [Compliance playbook](../playbooks/07-compliance-playbook.md#4-handling-data-subject-requests-dsrs): verify identity, route to DPO, fulfill within the legal window, log it.

## More how-tos
Browse [Runbooks](../runbooks/README.md) (operations) and [Developer guides](../developer/README.md) for deeper, numbered procedures.
