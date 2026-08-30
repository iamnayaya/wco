# Design Tokens

> Single source of truth. Every color, type, space, icon, motion, and layout value in WCO lives in one place and flows everywhere.

## Source of truth

[`design-tokens/index.ts`](../../packages/ui/src/design-tokens/index.ts) — the `designTokens` aggregate.

## The token modules

| Module | Owns | Key exports |
|---|---|---|
| `color.ts` | Colors | `brand`, `sun`, `clay`, `neutral(20)`, `semantic`, `cultural`, `systemLight/Dark`, `colors` |
| `typography.ts` | Type | `fonts`, `weights`, `sizes`, `lineHeights`, `letterSpacing`, `headings`, `typography` |
| `layout.ts` | Space/frame | `spacing`, `space`, `radii`, `shadows`, `duration`, `easing`, `motion`, `layout` |
| `animation.ts` | Motion | `durations`, `easings`, `steps`, `keyframes`, `reducedMotion`, `principles`, `animation` |
| `icons.ts` | Icons | `names`, `sizes`, `weights`, `states`, `animation`, `icons`, `iconA11y`, `isIconName` |
| `layout-system.ts` | Grid/layout | `breakpoints`, `media`, `grid`, `containers`, `whitespace`, `gridFor`, `layoutSystem` |
| `effects.ts` | Atmosphere | `gradients`, `glass`, `blur`, `dynamic`, `culturalRamp`, `focusTokens`, `effects` |
| `accessibility.ts` | A11y contracts | `contrast`, `touch`, `focus`, `reducedData`, `srOnly`, `roles`, `checklist`, `accessibility` |

## Reading the aggregate

```ts
import { designTokens } from '@wco/ui/design-tokens';

designTokens.color.primary;           // semantic hex (theme-aware via var)
designTokens.type.sizes.h1;           // clamp() string
designTokens.animation.easings.spring;
designTokens.icons.sizes.md;          // 24
designTokens.layoutSystem.grid.columns; // { base: 4, sm: 4, md: 8, ... }
designTokens.accessibility.touch;     // { minTarget: 44, spacing: 8 }
```

> Note: a few friendly names (e.g. `motion`, `animation`, `sizes`, `focus`, `cultural`) are shared by more than one module, so the barrel aliases them (e.g. `iconSizes`, `focusTokens`, `motionContract`). Import the canonical module or the aggregate to avoid surprises.

## Token naming conventions

- **Category → role → state**: e.g. `color.primary.hover`, `spacing.section.md`, `font.size.h1`.
- kebab-case CSS vars derive from camelCase: `primaryHover` → `--wco-primary-hover`.
- Never invent a value outside a category; if a token is missing, add it to the scale (governed) rather than hard-code.

## Theme tokens (light / dark)

`systemLight`/`systemDark` define the semantic layer per theme, bound to `--wco-*` CSS vars in `globals.css`. Dark is a **redesign**: lifted primary, softened borders, cool slate surfaces (see [Color](./color.md)).

## Platform tokens

The same tokens are consumed on web (Tailwind), mobile (React Native mirrors hex via the export map), and templates. Geometry tokens are unit-agnostic for future spatial targets.

## Token management

1. **One source** — never fork hex into components; always import or use `--wco-*`.
2. **Add, don't patch** — extend a scale (e.g. a new spacing step) under governance, not ad-hoc.
3. **Document intent** — each module's header explains *why* values were chosen.
4. **Ship as a pair** — any new light token gets a dark counterpart and both get AAA contrast.
5. **Sync code ↔ Figma** — see the [implementation guide](./implementation.md) for token-sync tooling.
