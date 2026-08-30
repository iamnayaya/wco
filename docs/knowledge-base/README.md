# Knowledge Base

The collective engineering knowledge of WCO: decisions, deep dives, best practices, lessons, how-tos, and FAQs. This is where institutional memory lives so we don't relearn the same lessons.

## Architecture decisions (ADRs)

The authoritative ADRs live in [`docs/adr/`](../adr/). Index:

| ADR | Title | Decision |
|---|---|---|
| [ADR-001](../adr/ADR-001-npm-workspaces-turborepo.md) | Monorepo tooling | npm workspaces + Turborepo over Nx/pnpm |
| [ADR-002](../adr/ADR-002-transactional-outbox.md) | Transactional outbox | atomic event emit → reliable async |
| [ADR-003](../adr/ADR-003-multi-tenancy.md) | Multi-tenancy | store-scoped isolation + RLS |

New decisions → create RPC/ADR in `docs/adr/` per the [template](../CONTRIBUTING.md#architecture-decision-records-adr).

## Sections

| Topic | Contents |
|---|---|
| [Architecture decisions](./01-architecture-decisions.md) | Rationale, alternatives, consequences |
| [Technical deep dives](./02-technical-deep-dives.md) | Deep dives into specific technologies |
| [Best practices](./03-best-practices.md) | Dev & ops practices that work |
| [Lessons learned](./04-lessons-learned.md) | From incidents, projects, and migrations |
| [How-to guides](./05-how-to-guides.md) | Task-oriented procedures |
| [FAQs](./06-faqs.md) | Team & technical FAQs |

## How to contribute
- Add content where it belongs; keep it concise and current.
- Follow the [Documentation style guide](../platform-style/02-style-guide.md).
- Link to canonical references rather than duplicating.

## Cross-references
- [Developer docs](../developer/README.md) · [Runbooks](../runbooks/README.md) · [Playbooks](../playbooks/README.md)
