# Playbook: Post-Mortem

How WCO conducts **blameless** post-incident reviews so we learn and improve without blame. Required for every S1 and S2 incident (within 5 business days).

## Principles
- **Be blameless.** The goal is systemic learning, not punishment. Assume everyone acted reasonably with the information they had.
- **Focus on systems & process**, not individuals.
- **Measure quality of learning**, not speed or severity of the event.
- Publish and share except where data is sensitive (e.g., security incidents are restricted).

## When a post-mortem is required
- Every **S1** and **S2** incident.
- Any incident that caused customer-facing impact, data loss, or a security event.
- **Optional** for S3/S4 that reveal valuable lessons or repeated patterns.

## Roles
- **Facilitator** (neutral; often a senior IC/PM) — runs the meeting, keeps it blameless.
- **Reporter(s)** — the IC + scribe from the incident (have the timeline).
- **Subject experts** — root-cause deep-dive.
- **Note-taker** — captures action items + decisions.

## The post-mortem meeting (~60 min)
1. **Timeline review** (10 min): run through logged events with timestamps.
2. **Impact summary** (5 min): users, revenue, duration, severity.
3. **Root-cause discussion** (25 min): use the **Five Whys** to reach systemic causes, not symptoms.
4. **What went well / what went wrong** (10 min). Include staff safety (incident response is stressful).
5. **Action items** (10 min): concrete, owned, with deadlines + tracking.

## Post-mortem template

```markdown
# Post-Mortem: <Title>

- **Date:** YYYY-MM-DD
- **Severity:** S1 / S2
- **Incident window / duration:**
- **Services affected:**
- **Users/customers affected:**

## Summary
2–3 sentences.

## Impact
Revenue, availability (SLO), data, customer trust.

## Timeline (all times UTC)
| Time | Event |
|---|---|

## Root cause
Five Whys from symptom to systemic cause.

## Detection & response
What worked / what didn't (alerting, runbooks, comms).

## What went well
## What went wrong

## Action items
| # | Action | Owner | Due | Status |
|---|---|---|---|---|

## Lessons / notes
```

## Action items & follow-through
- Every action has an **owner** and **due date**; track to closure (e.g., in the issue tracker).
- **High-priority/preventive** items (e.g., alerting gaps, missing runbook steps) land in the sprint.
- **Update runbooks/playbooks** when the incident revealed a gap — closing the loop is the point.
- A periodic review confirms action items are done and recurring issues are caught.

## If the same incident happens again
- Re-open the trend: are repeat incidents clustering? → drive a **first-principles fix** rather than another patch.
- Raise recurring patterns to the [Ops review](../guides/development-workflow.md) monthly meeting.
