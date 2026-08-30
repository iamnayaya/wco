# Docs Platform — Maintenance

How the WCO documentation stays accurate, fresh, and trustworthy over time. Documentation decays fast; this process is the counter-measure.

## 1. Ownership (DRI)

- **Docs lead** (DRI) — owns quality, structure, and the build pipeline.
- **Squad DRIs** — each squad keeps its `docs/developer`, runbooks, and playbooks current for their domain.
- **Everyone** — can propose edits via PR like code.

## 2. Keeping docs in sync with code (docs-as-code)

- Documentation lives in the **same repo and PR** as the code that changes it ([setup](./01-platform-setup.md)).
- Rule: **"No merged feature without its docs updated in that PR."** This is part of the Definition of Done ([Team processes](../onboarding/08-team-processes.md)).
- **One source of truth:** OpenAPI spec, README index, ADRs — reference them, don't fork them.

## 3. Review & update cadence

| Frequency | Activity | Owner |
|---|---|---|
| **Per PR** | Link-check + lint on docs | CI / author |
| **Per release** | Verify runbook commands & endpoints vs release | Squad DRI |
| **Monthly** | Docs health review (staleness scan, broken links, dead-end pages) | Docs lead |
| **Quarterly** | Full audit of sections vs current architecture | Docs lead + squads |
| **On incident** | Update the runbooks/playbook touched by the incident (as an action item) | Incident owner |

## 4. Links & structure checks

- Run the **link checker** (searches for broken relative links) on every docs PR and in CI.
- Add a **front matter `last_updated`** date to long-lived runbooks/playbooks so staleness is visible.
- A **section naming map** (in the README indexes) prevents drift between folders.

## 5. Deprecation & removal

- When a feature/endpoint is deprecated: mark it clearly, link the replacement, then **remove** in the next major version.
- Moving a doc? Keep a **redirect** (or update every inbound link) so readers don't hit dead ends.
- **Don't** keep "historical" docs that contradict current reality — that's the #1 trust-killer. Write the correct current truth and record the change decision in the changelog/ADR instead.

## 6. Build & pipeline maintenance

- The Docusaurus build is CI-gated: build fails on **broken links or lint errors**.
- API reference regenerates from `docs/api/openapi.yaml` via Redocly.
- Deploys are atomic via S3 + CloudFront ([setup](./01-platform-setup.md)); rollback = redeploy previous artifact.

## 7. Metrics that matter

Watch build health, broken-link count, and search/dwell analytics. Feedback loop: readers submit "This doc is wrong/unclear" (feedback button) → routed as a ticket → fixed by the DRI/squad.

## 8. Escalation
If docs are stale, raise it, don't silently suffer. Log a ticket assigned to the owning squad. The Docs lead arbitrates ownership disputes.

## 9. Related
- [Style guide](./02-style-guide.md) · [Localization](./04-localization.md) · [Platform setup](./01-platform-setup.md)
