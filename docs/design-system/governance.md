# Design System Governance

How the WCO design system is owned, changed, reviewed, versioned, deprecated, communicated, adopted, and measured. The goal: **the design system stays coherent, accessible, and trusted** as the product grows.

## 1. The team

A small, dedicated **Design System Guild** (rotating representation):

- **Design-system lead** — owns the token vocabulary and component APIs.
- **Core designers (web + mobile)** — own Figma library & patterns.
- **Frontend engineers** — own `packages/ui` implementation.
- **Accessibility champion** — owns the AAA contract & gates.
- **Developer-experience rep** — owns adoption, docs, and DX tooling.

> Everyone contributes; the guild decides. No single team "owns" it unilaterally.

## 2. Process (how changes happen)

1. **Propose** — open a design-system proposal (issue/Discussion): problem, usage, alternatives.
2. **Prototype** — spike in Figma + a branch in `packages/ui`.
3. **Review** (see below) against the 10 principles + accessibility contract.
4. **Ship** — bump the package, publish tokens+docs+components together.
5. **Adopt & measure** — roll out via the shared package; track metrics.

## 3. Review

- **Principles gate** — does it honor the 10 principles (esp. 1 simplicity, 5 AAA, 6 perf, 8 micro)?
- **Accessibility gate** — new colors verified AAA in both themes; keyboard/focus/screen-reader tested; axe green.
- **Motion gate** — durations within the scale; reduced-motion handled.
- **Token gate** — value added to a scale, not patched ad-hoc; dark counterpart shipped.
- **Backward-compat gate** — no silent breaking change; deprecation path for old tokens.

## 4. Versioning

- Semantic versioning (see [Implementation](./implementation.md)).
- Every **minor/major** change ships a changelog entry.
- Consumers pin/major-upgrade deliberately via the monorepo package.

## 5. Deprecation

- Deprecated tokens/components get a `-deprecated` alias **and** a loud warning for one full major cycle.
- Migration guides ship alongside the deprecation.
- After the deprecation cycle, the old API is removed in a major release — never silently.

## 6. Communication

- **Changelog** per release.
- **Design-system channel** for announcements (new tokens, deprecations, breaking changes).
- **Office hours** so teams get help/code reviews.
- Docs are the living home; keep `docs/design-system/*` in sync with every change.

## 7. Adoption

- Default-on: shared `@wco/ui` package + Tailwind theme means teams get the system "for free."
- **Contributor loop**: make it zero-friction to add an icon/token; guild reviews quickly.
- **Incentives**: adoption is a goal, not an exception; no page is allowed to inline ad-hoc values.
- **Patterns**: publish recipes for the most common journeys (commerce, messaging, analytics).

## 8. Metrics (how we measure success)

| Metric | Target |
|---|---|
| **Adoption** — % of pages/elements using tokens | ≥ 95% |
| **Duplication** — ad-hoc color/space instances | trending to 0 |
| **Accessibility** — axe violations in CI | 0 |
| **Contrast** — AAA pairs in both themes | 100% |
| **Motion budget** — durations outside the scale | 0 |
| **Speed** — P95 interaction latency, page load | ≤ budgets |
| **Reuse** — components used by >1 product area | ≥ 90% |
| **Velocity** — time from "new pattern" to shipped | < 1 week |

## Operating rhythm

- Weekly guild sync; monthly review of metrics; each release is additive, reviewed, and documented.

## Related

- [Implementation guide](./implementation.md) · [Accessibility guide](./accessibility.md) · [The 10 principles](./principles.md)
