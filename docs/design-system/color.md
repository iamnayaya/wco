# Color System

> **"Sunrise on the Savanna."** The palette is drawn from West and East African markets — red-earth sunlight, the green of growth, the amber of prosperity — engineered for trust, sunlight readability, and WCAG 2.1 **AAA**.

## Source of truth

- [`color.ts`](../../packages/ui/src/design-tokens/color.ts) — ramps, semantic, cultural, system (light/dark)
- [`effects.ts`](../../packages/ui/src/design-tokens/effects.ts) — gradients, glass, dynamic/time-of-day, full cultural ramps

## Brand ramps (10 shades each)

Each ramp is a Tailwind-style 50→950 scale.

| Ramp | Role | 50 | 500 | 600 | 900 |
|---|---|---|---|---|---|
| **Ember** (emerald) | Primary — growth, prosperity, financial trust | `#ecfdf5` | `#10b981` | `#059669` | `#064e3b` |
| **Sun** (amber) | Secondary — optimism, high-energy CTAs | `#fffbeb` | `#f59e0b` | `#d97706` | `#78350f` |
| **Clay** (terracotta) | Tertiary — red-earth warmth, handmade connection | `#fdf6f3` | `#cf6545` | `#b84d30` | `#692d21` |

## Neutrals — 20 steps

Cool-tinted gray (00 → 950), tuned for both themes: `#ffffff` → `#0b1120`. Used for text, surfaces, and borders. The two key pairs are purpose-designed:

| Pair (light) | / | (dark) | Contrast |
|---|---|---|---|
| `neutral.900` text on `neutral.00` | / | `neutral.00` text on `neutral.950` | **15.9:1 / 16:1** |
| `neutral.600` muted on `neutral.00` | / | `neutral.400` on `neutral.950` | **7.5:1 / 8.1:1** |

## Semantic colors

success / info / warning / danger — each with a **light+dark pair** so both themes meet AAA individually.

| Semantic | Light text | Light bg | Dark text | Dark bg |
|---|---|---|---|---|
| success | `#047857` | `#d1fae5` | `#6ee7b7` | `#064e3b` |
| info | `#0369a1` | `#e0f2fe` | `#7dd3fc` | `#0c4a6e` |
| warning | `#b45309` | `#fef3c7` | `#fcd34d` | `#78350f` |
| danger | `#b91c1c` | `#fee2e2` | `#fca5a5` | `#7f1d1d` |

## System / semantic aliases

Prefer **aliases**, never ad-hoc hex. They flip per theme and preserve AAA automatically.

- Light: `systemLight` → `--wco-*` in `:root`
- Dark: `systemDark` → `--wco-*` in `.dark`

Key rules: `primary` uses `brand.600` (AAA 6.5:1 on light) but **lifts to `brand.400`** (10.5:1) on dark; `accent` (Sun) is only for large UI, never body text.

## Cultural accents (per market)

One accent per market, usable as a theme touch. Full ramps in `effects.ts → culturalRamp`.

| Market | Accent | Name |
|---|---|---|
| Nigeria | `#f59e0b` Sun | vitality & optimism |
| Ghana | `#059669` Ember | growth & pride |
| Kenya | `#be123c` Rose | vitality |
| South Africa | `#6d28d9` Violet | ambition & royalty |

## Dynamic / time-of-day

`effects.ts → dynamic` provides context-adaptive ambience: `dawn`, `day`, `dusk`, `night` accents plus an `intensity` scale (low→max) for data-driven emphasis. Time-of-day themes only tint neutrals via the token layer — they never harm readability and are progressive enhancement (disabled by default).

## Accessibility

- Body text on background: ≥ **7:1** in both themes (AAA).
- Muted/description text: ≥ **7:1** (AAA).
- Faint/placeholder: ≥ **4.5:1** (AA+, exempt for 11px but kept readable).
- Large UI components: ≥ **3:1**.
- Every ad-hoc pair must be verified with a contrast checker before shipping (CI-gated — see [QA](../../qa/README.md)).

## Usage recipe

1. Reach for the **semantic alias** first (`--wco-primary`, `text-brand-600`).
2. Use `accent` (Sun) sparingly — large UI only, never body text.
3. Tint surfaces with `brand-50`/`sun-50`, not low-opacity full-strength colors.
4. Verify contrast on any new pair.
