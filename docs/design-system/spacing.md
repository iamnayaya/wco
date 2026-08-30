# Spacing System

> Space is the first design tool, not the last. WCO uses a **4px base unit** and a disciplined scale so every screen reads calm, aligned, and trustworthy — even when packed with commodity grids.

## Source of truth

- [`layout.ts`](../../packages/ui/src/design-tokens/layout.ts) — micro scale (spacing), semantic `space`, radii, shadows, motion
- [`layout-system.ts`](../../packages/ui/src/design-tokens/layout-system.ts) — macro whitespace rhythm

## Base unit — 4px

A 4px base keeps precision at small sizes and clean rhythm at large ones. Every gap, padding, and margin comes from the scale — **no ad-hoc px**.

## The scale (micro)

The 4px scale clusters at the small end (most rhythm is 4–16px); leap units (24/32/40+) dominate page rhythm.

```
px  1px
0   0px       0.5  2px
1   4px       1.5  6px
2   8px       2.5  10px
3   12px      3.5  14px
4   16px      5    20px
6   24px      7    28px
8   32px      9    36px
10  40px      11   44px
12  48px      14   56px
16  64px      18   72px
20  80px      24   96px
28  112px     32   128px
36  144px     40   160px
44  176px     48   192px
52  208px     56   224px
60  240px     64   256px
```

## Semantic aliases

```
none  0px · xs  4px · sm  8px · md  16px · lg  24px · xl  40px · 2xl  64px · 3xl  96px
```

Prefer these names in components so intent reads over raw numbers.

## Component spacing (from the UI library)

- **Controls**: height 32/44/52/60 (`sm`/`md`/`lg`/`xl`); internal padding `10/14/18/22`.
- **Touch**: target ≥ **44px**, ≥ **8px** between adjacent targets (WCAG 2.5.8).
- **Cards**: padding `12/20/28/40` (`sm`→`xl`).
- **Buttons/icons**: gap `6/8/10/12`.

## Layout / macro rhythm

Section-level intervals create calm:

| Token | px | Use |
|---|---|---|
| `sectionXs` | 24 | Related cards |
| `sectionSm` | 40 | Mobile section rhythm |
| `sectionMd` | 64 | Desktop section rhythm |
| `sectionLg` | 96 | Hero / major break |
| `sectionXl` | 128 | Full page-break |
| `pagePad` | 16/24/32 | Dashboard screen padding (base/lg) |

Page padding and grid margins are **responsive** (`pagePad` and `grid.margin` scale up at larger breakpoints).

## Radii

```
none 0 · sm 6 · md 10 · lg 12 · xl 16 · 2xl 20 · 3xl 24 · full 9999 (pills only)
```

Soft but not pill-overload — `full` is reserved for badges/pills so surfaces stay crafted, not cartoonish.

## Elevation (shadows)

- `card` / `raised` / `popover` / `modal` / `focus` — crisp + light in light mode.
- **Dark mode relies on surface-tone contrast, not heavy black drops.**

## Whitespace philosophy

1. **Generous macro space** (≥ 64px sections) so dense data reads calm.
2. **Alignment is a feature** — everything lands on the 4px grid.
3. **Let content breathe** — empty space is the affordance, not filler.
4. When in doubt, add one more `space-sm` to related items and one more `sectionMd` between unrelated groups.
