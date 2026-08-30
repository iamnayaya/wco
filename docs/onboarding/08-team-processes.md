# Onboarding — Team Processes

WCO's engineering rituals, meetings, and how the team works together. The full team-topology and workflow: [Development workflow](../guides/development-workflow.md).

## Team topology
Engineering is organized into squads around business capabilities:

| Squad | Responsibilities |
|---|---|
| **Platform** | infra, CI/CD, shared packages, golden paths |
| **Merchant Experience** | frontend, mobile |
| **Commerce Core** | backend, orders, products, customers |
| **Payments & Logistics** | payments, logistics |
| **AI/ML** | ai-engine, pricing, forecasting |
| **Growth** | marketing, analytics, dashboards |

Each squad: 1 EM, 1 PM, 1 designer, 4–6 engineers. The platform team runs internal golden paths.

## Rituals & cadence

| Ritual | Cadence | Purpose |
|---|---|---|
| Sprint planning | bi-weekly, 90 min | commit to prioritized backlog |
| Standup | async written (Slack) by default; voice when blocked | block/unblock; maker-time respect across time zones |
| Demo Friday | weekly, 45 min | working software demos, company-wide |
| Retro | bi-weekly per squad | action items tracked, max 3 |
| Arch review | weekly | RFCs/ADRs discussed, recorded |
| Ops review | monthly | incidents, SLO trends, flaky debt, cost anomalies |
| Tech-debt budget | 20% of each sprint (protected) | pay down debt ruthlessly |

## Definition of Done (per story)
- [ ] Code complete with tests (unit ≥ 80% changed-lines coverage)
- [ ] Integration test for API changes (Testcontainers)
- [ ] Contract tests updated (Pact) if API surface changed
- [ ] Lint + typecheck + tests green in CI
- [ ] Self-reviewed diff
- [ ] Documentation updated
- [ ] Feature flagged if user-facing and incomplete
- [ ] Migrations reversible, tested up and down
- [ ] Observability added (metrics/logs/traces)
- [ ] Security checklist passed
- [ ] Product owner acceptance

## Working agreements
- **Async-first** to respect time zones (Lagos/Accra/Nairobi ±1h).
- **Trunk-based** development, short-lived branches, squash merges.
- **Feature flags** for incomplete work (ship dark).
- **Document decisions** (ADRs/RFCs) — no hallway decisions.
- **Incidents are blameless** — see [Post-mortem playbook](../playbooks/03-post-mortem-playbook.md).

## Meetings you'll be in
- Squad sprint planning + retro + standup.
- Weekly arch review (optional by interest).
- Monthly ops review (as rotating attendee).
- Demo Friday (all).

## Communication norms
- Keep decision threads in Slack/issue/RFC (searchable), not ephemeral calls alone.
- Post useful outputs to the relevant channel for async teams.
- Use `#incidents` for live incidents; on-call pages come via PagerDuty.
