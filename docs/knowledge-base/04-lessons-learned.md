# Knowledge Base: Lessons Learned

Hard-won lessons from incidents, projects, and migrations. Every entry captures what went wrong and what we changed so it doesn't recur. Keep this honest — it's how we get better.

> Format: **Situation → What happened → Root cause → Fix / change → Status.**

## Lesson 1 — Never publish to the queue directly from a controller

- **Situation:** A feature emitted a "send notification" side effect by publishing to RabbitMQ directly from a service method.
- **What happened:** On a deploy, a process died between the DB commit and the publish → a customer's order confirmation email was silently lost.
- **Root cause:** Violated the transactional-outbox pattern ([ADR-002](../adr/ADR-002-transactional-outbox.md)).
- **Fix/change:** Refactored to emit a domain event row in the same DB transaction; relay publishes atomically. Added a code-review checklist item + lint/arch note.
- **Status:** Resolved — pattern now enforced and documented.

## Lesson 2 — Secret in Git is a rotation event, not a "remove it" event

- **Situation:** A test API key was committed to a config file.
- **What happened:** Git history preserved it even after the later "fix" commit removed it from `HEAD`.
- **Root cause:** Underestimated that Git history is immutable without history rewrite.
- **Fix/change:** **Rotated the key** (dual-write), added `gitleaks` secret scanning to CI to block keys pre-merge, added `.env`/secret patterns to `.gitignore`.
- **Status:** Resolved — CI now blocks hardcoded secrets ([Security runbook](../runbooks/07-security-runbook.md)).

## Lesson 3 — Throttled auth + strict CORS prevent most scraping/abuse

- **Situation:** A new public endpoint got scraped, spiking load.
- **What happened:** Lack of per-principal rate limits + overly broad CORS allowed abuse at higher volume.
- **Root cause:** Security not baked into the new endpoint's design.
- **Fix/change:** Enforced the [rate-limit tiers](../api/design-guidelines.md#12-rate-limit-tiers) + strict CORS allowlist + WAF rules as standard for every endpoint.
- **Status:** Resolved — new endpoints must declare their rate tier in design.

## Lesson 4 — Blameless post-mortems are non-negotiable

- **Situation:** Early incident reviews became blame sessions; the team stopped sharing honest details.
- **What happened:** Issues went unreported; fixes addressed symptoms, not systems.
- **Root cause:** Culture, not tooling.
- **Fix/change:** Adopted the [Post-mortem playbook](../playbooks/03-post-mortem-playbook.md) — blameless, action-item tracked. Honesty is now the norm.
- **Status:** Ongoing — reinforced at every ops review.

## Lesson 5 — Backward-compatible migrations save release pain

- **Situation:** A "fast" migration dropped a column and renamed another in one release.
- **What happened:** Old code (still running during rolling deploy) broke against the new schema.
- **Root cause:** Violated the expand-migrate-contract / two-release rule.
- **Fix/change:** Made breaking migrations span two releases; migration job runs before new pods; tested up and down.
- **Status:** Resolved — enforced in [Deployment guide](../developer/09-deployment-guide.md#database-migrations).

## Lesson 6 — Restore drills reveal broken backups

- **Situation:** Relied on automatic backups without testing restore.
- **What happened:** A test restore failed (corrupt snapshot / missing permission), which would have been catastrophic in a real DR event.
- **Root cause:** "Backups exist" ≠ "restores work."
- **Fix/change:** Monthly restore drills per [Backup runbook](../runbooks/04-backup-recovery-runbook.md); testable restore added to DR posture.
- **Status:** Resolved — drills run monthly.

## Adding new lessons
When you close out an incident, migration, or project, capture the takeaway here. Keep entries **brief, honest, and actionable**. Link runbooks/docs that now prevent the recurrence.
