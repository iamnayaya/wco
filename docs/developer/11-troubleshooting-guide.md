# Developer Troubleshooting Guide

Common issues developers hit while building and running WCO locally, in CI, and in deployed environments. For user-facing issues, see [Troubleshooting guides](../troubleshooting/README.md); for incidents, see the [Playbooks](../playbooks/README.md).

> **If this is a production incident affecting users**, skip to the [Incident response runbook](../runbooks/03-incident-response-runbook.md) — do not debug quietly.

## Local development issues

### `npm install` fails with native module build errors

- **Symptom:** `node-gyp` / `bcrypt` / `sharp` build errors, especially on Windows.
- **Fix:** Use WSL2 + Docker Desktop with the WSL backend, or install Windows build tools:
  ```bash
  npm install --global windows-build-tools
  ```
- **Verify:** `node -v`, `npm -v`, and re-run `npm install`.

### Ports already in use (3000 / 4000 / 5432 / etc.)

- **Symptom:** EADDRINUSE on startup.
- **Fix:** Find and stop the process, or change the port in `.env` and `infra/docker/docker-compose.yml`.
  ```bash
  # Windows (find PID on a port)
  netstat -ano | Select-String ":3000"
  ```

### Prisma client not generated

- **Symptom:** `PrismaClient` is not exported / cannot find in `@wco/database`.
- **Fix:**
  ```bash
  npx prisma generate   # in @wco/database
  ```

### RabbitMQ or Redis won't start in Docker

- **Symptom:** containers crash-loop, health check failing.
- **Fix:** Increase Docker memory; check port conflicts; `npm run docker:down && npm run docker:up`.

### Database migration fails locally

- **Symptom:** `npm run db:migrate` errors.
- **Fix:** Ensure Postgres container is healthy; `npm run db:reset` to start clean (dev only).

## CI issues

### Gate failed on lint / format

- **Fix:** `npm run lint:fix && npm run format`, then commit the fixes.

### Coverage below threshold

- **Symptom:** QA coverage gate fails (changed-lines < 80%, or backend threshold).
- **Fix:** Add tests for the changed code paths. See [Testing guide](./08-testing-guide.md).

### E2E flaky test quarantined

- **Symptom:** Playwright test fails intermittently.
- **Fix:** Ping QA / run the test locally; a flaky test is quarantined after 2 consecutive failures and fixed within the sprint. Don't merge past a red gate.

### Secret scan (gitleaks) fails

- **Symptom:** a secret-like string is detected.
- **Fix:** Remove the committed secret/token. Never push secrets. Rotate anything that leaked.

## Runtime / deployed issues

### API returns 429 (rate limited)

- Check `RateLimit-*` response headers. If a legitimate auto-responder is throttled, request a higher rate tier (see [API: Rate limiting](../api/design-guidelines.md#12-rate-limit-tiers)).

### API returns 401/403 unexpectedly

- **JWT expired** → refresh via the refresh token (rotation).
- **Wrong store scope** → ensure `X-Store-Id` matches the user's membership.
- **RBAC** → check role permissions (OWNER/ADMIN/AGENT/VIEWER) in the [RBAC matrix](../api/authentication-authorization.md).

### Messages not being auto-replied (AI)

1. Confirm the WhatsApp webhook is connected (status endpoint).
2. Check the inbox/outbox **queue depth** in RabbitMQ.
3. Check the AI engine logs/traces for the message.
4. Verify the store's AI config + response templates are enabled.
5. Confirm LLM API keys are valid and within quota.

### Order/payment webhook not processed

1. Check the webhook-handler logs for the payload.
2. Verify signature validation passes (HMAC).
3. Confirm the outbox relay delivered the event.
4. Check retry/dead-letter queue — see [Queue runbook](../runbooks/10-queue-runbook.md).

## "I've checked everything and still stuck"

1. Grep for the correlation `requestId` across logs + trace.
2. Check Sentry for recent exceptions on the affected service.
3. Ask in the appropriate Slack channel (`#wco-dev`, `#wco-backend`, `#wco-ai`).
4. If a runbook was missing a step, file a docs PR — docs are an owned product.
5. Offer to write a new section here for the next person.

## When to escalate

- **Production impact (users affected):** follow [Incident management playbook](../playbooks/01-incident-management-playbook.md) — severity S1/S2 with defined response times.
- **Data loss / security concern:** immediately contact security (see [Security incident response](../security/07-security-incident-response.md)).
- **Blocked > 1 day:** raise in standup / with your tech lead; escalate through [Development workflow](../guides/development-workflow.md).

Next: [Contributing guide](./12-contributing-guide.md).
