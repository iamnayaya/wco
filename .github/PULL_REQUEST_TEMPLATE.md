<!-- Title format: [WCO-123] concise description (conventional-commit style prefix optional) -->

## What does this PR do?

<!-- One or two sentences. Link the Linear/Jira ticket: Closes WCO-123 -->

## Type of change

- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] perf
- [ ] test
- [ ] docs
- [ ] chore / build / ci

## How was it tested?

- [ ] Unit tests added/updated (`npm run test:unit`)
- [ ] Integration tests (`npm run test:integration`)
- [ ] E2E for critical path (`npm run test:e2e`)
- [ ] Manual verification steps below

<!-- Steps a reviewer can follow to verify locally -->

## Screenshots / Recordings (UI changes)

| Before | After |
| ------ | ----- |
|        |       |

## Risk & Rollback

- Blast radius:
- Feature flag involved? <!-- flag name -->
- Rollback plan:

## Checklist

- [ ] Conventional Commits used; branch up to date with `develop`
- [ ] No secrets committed; new env vars added to `.env.example` + deployment config
- [ ] DB changes have reversible migrations (expand → migrate → contract)
- [ ] Observability: logs/traces/metrics added for new paths
- [ ] Docs updated (README/ADR/api docs) if behavior changed
