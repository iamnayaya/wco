# Animation System

> **Motion that means something.** Every animation earns its place — it clarifies a relationship, celebrates a win, or guides recovery. We obey a strict motion budget so WCO feels alive at 60fps on a $100 Android, never flustered.

## Source of truth

[`animation.ts`](../../packages/ui/src/design-tokens/animation.ts) + keyframes in `globals.css` and `tailwind.config.ts`.

## Durations (distance-aware)

| Token | ms | Use |
|---|---|---|
| `instant` | 0 | ripple, no-wait feedback |
| `micro` | 100 | hover, press, focus, drag-start |
| `fast` | 120 | color/border/small-scale changes |
| `base` | 200 | workhorse state transitions |
| `moderate` | 280 | panel slide, list reorder |
| `slow` | 400 | modal enter, drawer, page transition |
| `slower` | 650 | toast, celebrate, sheet collapse |
| `deliberate` | 900 | confetti, onboarding flourish |

**Budget:** never exceed `deliberate` (900ms). CI lints durations outside the scale.

## Easings (physical, crafted)

`standard` (workhorse) · `emphasized` (eager entrance) · `exit` (decisive) · `spring` (delight only) · `linear` (progress) · `decelerate` · `accelerate` · `bounceIn` · `easeOutQuint` · `easeInOutQuad`.

Rules: **entrance decelerates**, **exit accelerates**, **spring is for delight only**.

## Presets (reusable steps)

`hover` · `press` · `button` · `cardLift` · `focusRing` · `overlay` · `panelEnter` · `toastIn` · `listStagger` · `celebrate` · `shimmer` · `focusVisible` — each is `{ property, duration, easing }`. Components reference these instead of hand-rolled transitions.

## Keyframes (the primitives)

`fadeIn` · `fadeInScale` · `slideUp/Down` · `slideInRight/Bottom` · `pop` · `pulse` · `shimmer` · `skeleton` · `spin` · `celebrate` · `ripple` + icon tools `wco-icon-pulse`/`ring`.

Tailwind exposes these as utilities: `animate-pop`, `animate-pulse`, `animate-skeleton`, `animate-shimmer`, `animate-spin`, `animate-celebrate`, `animate-slide-in-bottom`, plus `.celebrate`, `.icon-spin`, `.icon-pulse`, `.icon-ring`, `.icon-pop` component classes.

## Micro-interactions

Every interactive element has crafted feedback:

- **Press** — scale to `0.985` on mousedown/keydown (buttons).
- **Hover** — tint + hover-lift on `cardLift`.
- **Focus** — 2px `--wco-ring` ring, 2px offset.
- **Success** — `celebrate` pop on payouts; a confirmation tick pops in.
- **Error** — a subtle shake is *not* used; errors ease down with a hint instead (calmer, more accessible).

## Page transitions

Drawers/panels enter with `slideInRight`/`slideInBottom` on `emphasized`; modals fade the overlay `moderate` and enter the panel `slow`/`emphasized`. Lists stagger at ≤ 48ms offsets, total ≤ 400ms.

## Loading

Real-shape skeletons with `wco-skeleton` shimmer replace spinners for async lists (per [`accessibility.ts`](../../packages/ui/src/design-tokens/accessibility.ts) — "loading is designed"). The `wco-spin` spinner remains for short inline processing.

## Reduced motion (the contract)

Under `prefers-reduced-motion`, all expressive travel collapses to **0.01ms opacity cross-fades**; infinite animations run once; `scroll-behavior` is forced to auto. Reduced transparency drops backdrop-blur to solid surfaces. See [`animation.ts` → `reducedMotion`](../../packages/ui/src/design-tokens/animation.ts).

## The 10 animation principles

Enforced in code + review — see the `principles` export and [the full list in `animation.ts`](../../packages/ui/src/design-tokens/animation.ts). Highlights:

1. Every motion has a job. 2. Closest motion wins (transform/opacity). 3. Respect the 60fps contract. 4. Honor reduced motion. 5. Micro-moments feel physical. 6. Enter eager, exit decisive. 7. Stagger, don't sync. 8. Celebrate with restraint. 9. Loading is designed. 10. Motion budgets are sacred.
