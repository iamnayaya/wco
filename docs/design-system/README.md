# WCO Design System

> **"Sunrise on the Savanna"** — a trillion-dollar-grade design language for **WhatsApp Commerce OS**. Warm, trustworthy, culturally intelligent, and built to a standard that makes Apple, Google, and Stripe take notes.

This is the **single source of truth** for what WCO looks and feels like. It is *code, not prose*: every token below is a real, shipped module that the product builds on.

## The 12 layers

| # | Layer | Source of truth | Status |
|---|---|---|---|
| 1 | **Design principles** | [`principles.md`](./principles.md) | ✔ 10 radical rules |
| 2 | **Color system** | [`color.ts`](../../packages/ui/src/design-tokens/color.ts) + [`effects.ts`](../../packages/ui/src/design-tokens/effects.ts) | ✔ ramps · semantic · cultural · dynamic |
| 3 | **Typography** | [`typography.ts`](../../packages/ui/src/design-tokens/typography.ts) | ✔ fluid scale · H1–6 · 9 weights |
| 4 | **Spacing** | [`layout.ts`](../../packages/ui/src/design-tokens/layout.ts) + [`layout-system.ts`](../../packages/ui/src/design-tokens/layout-system.ts) | ✔ 4px base · macro rhythm |
| 5 | **Icons** | [`icons.ts`](../../packages/ui/src/design-tokens/icons.ts) + [`components/Icon.tsx`](../../packages/ui/src/components/Icon.tsx) | ✔ 100+ vocab · 5 sizes · 3 weights |
| 6 | **Animation** | [`animation.ts`](../../packages/ui/src/design-tokens/animation.ts) | ✔ durations · easings · presets · keyframes |
| 7 | **Layout system** | [`layout-system.ts`](../../packages/ui/src/design-tokens/layout-system.ts) | ✔ grid · breakpoints · containers |
| 8 | **Tokens** | [`design-tokens/index.ts`](../../packages/ui/src/design-tokens/index.ts) | ✔ unified aggregate |
| 9 | **Accessibility** | [`accessibility.ts`](../../packages/ui/src/design-tokens/accessibility.ts) + [`accessibility.md`](./accessibility.md) | ✔ WCAG 2.1 AAA |
| 10 | **Documentation** | this directory | ✔ 12 guides |
| 11 | **Implementation** | [`implementation.md`](./implementation.md) | ✔ Figma · code · token-sync |
| 12 | **Governance** | [`governance.md`](./governance.md) | ✔ team · process · metrics |

## Why this is different

- **Accessible by design, not by audit.** Every semantic pair ships at WCAG 2.1 **AAA** (≥ 7:1) in *both* light and dark — not as an afterthought patch.
- **Dark mode is a redesign, not an inversion.** Dark surfaces are cool slate, primary lifts, shadows give way to surface-tone contrast.
- **Culturally intelligent.** The `Sun`/`Ember`/`Clay` palette and per-market accent ramps (NG/GH/KE/ZA) mean it resonates with the merchants who power the emerging economy — not a generic Silicon Valley blue.
- **Motion that means something.** A strict motion budget (≤ 900ms, transforms/opacity only, 60fps) with a full reduced-motion contract.
- **Future-proof geometry.** Fluid type, a 4→16 column grid, and tokens independent of fixed pixels — the same system renders on a $100 Android *and* a spatial display.

## The recipe at a glance

```
design-tokens/
  color.ts           brand(Sun/Ember/Clay) · neutral(20) · semantic · cultural · systemLight/Dark
  typography.ts      Inter sans + mono · 9 weights · fluid clamp() scale · H1–6
  layout.ts          spacing(4px→256) · radii · shadows · duration/easing/motion
  animation.ts       durations(10) · easings(10) · steps · keyframes · reducedMotion · principles
  icons.ts           100+ name vocabulary · sizes(6) · weights(3) · states · micro-motion
  layout-system.ts   breakpoints(5) · grid(4→16 col) · containers · whitespace
  effects.ts         gradients · glass · blur · dynamic/time-of-day · culturalRamp · focus
  accessibility.ts   contrast(AAA) · touch(44px) · focus · reducedData · srOnly · checklist
  index.ts           the designTokens aggregate (single import)
```

## How it's used

```ts
import { designTokens } from '@wco/ui/design-tokens';

designTokens.color.primary;     // semantic hex
designTokens.animation.easings; // easing curves
designTokens.layoutSystem.grid; // columns per breakpoint
designTokens.accessibility.touch; // 44px target contract
```

In Tailwind, the same tokens are already mapped to utilities (`brand-600`, `text-h1`, `rounded-xl`, `shadow-card`, `animate-pop`, `max-w-app`, etc.) — see the [implementation guide](./implementation.md).

## Quick links

- [The 10 principles](./principles.md) · [Color](./color.md) · [Typography](./typography.md) · [Spacing](./spacing.md)
- [Icons](./icons.md) · [Animation](./animation.md) · [Layout](./layout.md) · [Tokens](./tokens.md)
- [Accessibility (AAA)](./accessibility.md) · [Implementation](./implementation.md) · [Governance](./governance.md)

## Related

- [QA & release readiness](../qa/README.md) · [Developer: styling & testing](../developer/05-code-style-guide.md) · [Platform style guide](../platform-style/02-style-guide.md)
