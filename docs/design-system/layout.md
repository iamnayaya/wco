# Layout System

> **Structure that disappears.** The grid is the quiet skeleton behind every screen. It resolves at five breakpoints, is fluid (no fixed-pixel assumptions → foldables and spatial displays just work), and uses a whitespace philosophy that lets commerce content breathe.

## Source of truth

[`layout-system.ts`](../../packages/ui/src/design-tokens/layout-system.ts)

## Breakpoints (mobile-first)

| Token | px | Class |
|---|---|---|
| base | 0 | `< 640` |
| `sm` | 640 | `≥ 640` |
| `md` | 768 | `≥ 768` |
| `lg` | 1024 | `≥ 1024` |
| `xl` | 1280 | `≥ 1280` |
| `2xl` | 1536 | `≥ 1536` |

Media-query strings are provided as `media.*` and mapped to Tailwind `screens` (with a `base` alias).

## The grid (4 → 16 columns)

| Breakpoint | Columns | Gutter |
|---|---|---|
| base / sm | 4 | 16px |
| md | 8 | 16px |
| lg / xl | 12 | 16px |
| 2xl | 16 | 16px |

Outer page margins scale: 16 (base) → 16 → 24 → 32 → 40 → 48. Helper `gridFor(width)` returns `{ columns, gutter, margin }` for a viewport.

## Containers (page rails)

| Token | max-width | Use |
|---|---|---|
| `narrow` | 480px | wizards, verification |
| `prose` | 680px | reading column |
| `app` | 1200px | standard dashboard rail |
| `wide` | 1440px | analytics / data reports |

Mapped to Tailwind `max-w-narrow/prose/app/wide` and the `container` component.

## Whitespace (macro rhythm)

`sectionXs 24` · `sectionSm 40` · `sectionMd 64` · `sectionLg 96` · `sectionXl 128` · `pagePad 16/24/32` — see [Spacing](./spacing.md).

## Layout templates (semantic regions)

| Region | Composition |
|---|---|
| `page` | full scroll container |
| `appRail` | `app` container, centered |
| `twoPane` | sidebar + content |
| `threePane` | nav + list + detail (e.g. conversations) |
| `dataRegion` | toolbar + table |
| `focused` | single decision (modal/dialog) |

## Responsive & flexible layout rules

1. **Mobile-first** — design at 4 columns, scale up; never strip features down by breakpoint.
2. **Fluid, not fixed** — widths derive from containers + percentages; center with `container`/`max-w-*`.
3. **Content wins** — the grid accommodates content; a list that needs 8 of 12 columns uses 8, not a hard 12.
4. **Never fight the grid** — alignment is a feature; use grid-gap from the spacing scale.
5. **Accessible** — single-column stacking for critical journeys; keep reading width ≤ `prose` for body copy.

## Dark mode

Layout geometry is theme-agnostic; only surface/border tokens change (see [Color](./color.md)).
