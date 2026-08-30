# Implementation Guide

How to take the WCO design system from tokens to a shipping product — Figma, code, token-sync, component development, testing, docs, versioning, and deployment.

## 1. Figma setup

1. **Create a WCO library with pages mirroring the token modules**: Color, Typography, Spacing, Icons, Components, and a "Foundations" page.
2. **Name styles after tokens** exactly: color `brand/600`, text `type/h1`, space `space/md`, `icons/sizes/md`, `motion/easings/spring`.
3. **Enable variables** (Styles → Variables) for color, spacing, radius, and typography so designers consume tokens, not hex.
4. **Dark mode** as a second theme set of the same variable names (never a separate "dark" grey pile).
5. **Publish as a library**; teams enable it and use "Team Library" components.

## 2. Code setup

```bash
npm install @wco/ui          # tokens + React primitives + Icon
```

- Tailwind: tokens already mapped in [`tailwind.config.ts`](../../apps/frontend/tailwind.config.ts) (`brand-600`, `text-h1`, `rounded-xl`, `shadow-card`, `animate-pop`, `max-w-app`, `min-h-touch`).
- Runtime components: import from `@wco/ui` (e.g. `Button`, `Card`, `MessageBubble`, `Icon`).
- Global styles: import `globals.css` (theme vars + keyframes + focus/skip-link).

## 3. Token sync (Figma ↔ code)

- **Source of truth is code** (`design-tokens/*`). Design tokens → variables by convention; tooling can diff.
- Recommended pipeline:
  1. Export tokens as **Style Dictionary / W3C Design Tokens** JSON.
  2. Generate both `design-tokens/*.ts` and a `tokens.json` for Figma tokens plugin / Figma Variables import.
  3. Add a CI check (`tokens:check`) that fails if code and the exported snapshot drift.

```jsonc
// tokens.json (W3C, illustrative)
{
  "color": {
    "brand": { "600": { "$type": "color", "$value": "#059669" } }
  },
  "type": {
    "h1": { "$type": "dimension", "$value": "clamp(1.875rem,4vw,2.5rem)" }
  }
}
```

## 4. Component development

- Components live in `packages/ui/src/components/*.tsx`, theme via `sem()` with the triple `--wco-*` → `--fallback-*` → hex fallback chain (that's what makes them light/dark-ready and standalone-unstyled-proof).
- New components must:
  - Use tokens (no ad-hoc px/hex).
  - Support `className`/`style` merge via `cn`.
  - Forward `ref` and spread native props/aria.
  - Ship the `wco-<name>` class for test and styling hooks.

## 5. Testing

- **Unit/component** — Vitest + Testing Library, jsdom, asserting roles/ARIA/keyboard (colocate `*.test.tsx`). CSS is not processed; assertions are against the DOM contract.
- **Accessibility** — axe-core in CI + role/keyboard assertions.
- **Visual/regression** — Playwright screenshots at the 5 breakpoints, light + dark.
- **Perf** — motion budget lint (durations within scale) + Core Web Vitals budgets.

## 6. Documentation

- Component JSDoc with `@example`. High-level docs live in `docs/design-system/*`.
- Each token module's header states **why** values were chosen.
- Publish a storybook-style gallery from `packages/ui/stories` (next).

## 7. Versioning

- Design system follows **semver**:
  - **Minor** — additive tokens/components (backward compatible).
  - **Minor/patch** — token value changes that don't break APIs.
  - **Major** — breaking name/API/theme changes.
- Updates ship via the monorepo + the shared `@wco/ui` package; consumers bump deliberately.
- Changelog per release.

## 8. Deployment

- The UI package builds with `tsc --noEmit` (type + shape) and is consumed by apps (frontend, mobile via RN mirror).
- Frontend: static export / SSR as configured; dark mode toggled by `theme-provider.tsx`.
- CI: `typecheck` + `test:unit` + lint + a11y gates on every PR (see [QA](../../qa/README.md)).

## Voice & spatial readiness

- Voice flows reuse the same semantic components; label them (`.wco-*` + `aria`) so speech targets map to controls.
- Geometry is token-driven and unit-agnostic — the same tokens render on a spatial display (see [principles](./principles.md) #10).
