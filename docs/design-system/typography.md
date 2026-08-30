# Typography System

> **"Clear at a glance, calm at a scan."** Inter is the voice — it reads superbly at small sizes, in wide scripts, and in direct sunlight (the top concern of informal traders).

## Source of truth

[`typography.ts`](../../packages/ui/src/design-tokens/typography.ts)

## Fonts

| Family | Use |
|---|---|
| **Inter** + system stack | Primary UI + body |
| **UI monospace** (SF Mono / Menlo / Consolas) | Code, data, IDs, tables |

## Weights (9)

100 Thin · 200 ExtraLight · 300 Light · 400 Regular · 500 Medium · 600 Semibold · 700 Bold · 800 ExtraBold · 900 Black. In practice 400/500/600/700 dominate; 100–300 are for display-only use.

## Fluid scale (clamp, no breakpoint jumps)

Every step is a `clamp(min, preferred, max)` so type scales continuously from phone → desktop.

| Token | clamp | ≈mobile | ≈desktop |
|---|---|---|---|
| `display` | `clamp(2.75rem, 8vw, 4.5rem)` | 44 | 72 |
| `display-sm` | `clamp(2.25rem, 6vw, 3.5rem)` | 36 | 56 |
| `h1` | `clamp(1.875rem, 4vw, 2.5rem)` | 30 | 40 |
| `h2` | `clamp(1.5rem, 3.2vw, 2rem)` | 24 | 32 |
| `h3` | `clamp(1.25rem, 2.6vw, 1.625rem)` | 20 | 26 |
| `h4` | `clamp(1.125rem, 2vw, 1.375rem)` | 18 | 22 |
| `lg` | `clamp(1.125rem, 1.6vw, 1.25rem)` | 18 | 20 |
| `base` | `clamp(0.9375rem, 1vw, 1rem)` | 15 | 16 |
| `sm` | `clamp(0.8125rem, 0.9vw, 0.875rem)` | 13 | 14 |
| `xs` | `clamp(0.6875rem, 0.7vw, 0.75rem)` | 11 | 12 |
| `2xs` | `clamp(0.625rem, 0.6vw, 0.6875rem)` | 10 | 11 |
| `data-sm` | `clamp(0.75rem, 0.8vw, 0.8125rem)` | 12 | 13 |

## Line heights

- Display: `1.05` → body: `1.6`. Headings tighten (`1.15`–`1.3`), body loosens for readability.

## Letter spacing

- Display/headings: slightly negative (`-0.02em` → `-0.01em`) for a premium, legible weight.
- Body: `0` (prevents shimmer on mobile).
- Small labels: positive (`0.01em`–`0.02em`) to aid scanning.

## Heading hierarchy (H1–H6)

```
H1  bold   clamp(1.875–2.5rem)
H2  semi   clamp(1.5–2rem)
H3  semi   clamp(1.25–1.625rem)
H4  semi   clamp(1.125–1.375rem)
H5  semi   lg (18–20)
H6  semi   base (15–16)
```

Each level is visually+audibly distinct; never skip levels.

## Paragraph spacing

- `base` 12px · `sm` 10px · `lg` 16px — optimized so dense commerce copy stays scannable.

## Responsive

- The `--font-inter` var sets the family; `html { font-size: clamp(15px, 1rem+0.25vw, 17px) }` gives a gentle root scale so `rem`-based UI breathes on every screen without layout thrash.

## Accessibility

- Never size body text below `sm` (13px). Use `2xs`/`data-sm` only for labels/tables.
- Target ≥ 7:1 for all body/muted text (see [Accessibility](./accessibility.md)).
