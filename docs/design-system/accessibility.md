# Accessibility Guide (WCAG 2.1 AAA)

> **Accessible by design, not by audit.** WCO targets WCAG 2.1 **AAA** — beyond AA — in both themes, plus perceivability, operability, and robustness beyond the spec. The enforceable contract lives in [`accessibility.ts`](../../packages/ui/src/design-tokens/accessibility.ts).

## The contract

| Area | Guarantee |
|---|---|
| Body text on background | ≥ **7.0:1** (light **and** dark) |
| Muted/description text | ≥ **7.0:1** |
| Faint/placeholder | ≥ **4.5:1** |
| Large text (≥24 / ≥19 bold) | ≥ **4.5:1** |
| Large UI components | ≥ **3.0:1** |
| Focus indicator | visible 2px `--wco-ring`, 3px `CanvasText` fallback |

## Color & contrast

- Every semantic text/surface pair ships at AAA in both themes (see [Color](./color.md)).
- Prefer `--wco-*` semantic aliases so theme/AAA are preserved automatically.
- Verify any ad-hoc pair with axe + a contrast checker before shipping; CI-gated in [QA](../../qa/README.md).

## Touch & pointer (WCAG 2.5)

- Minimum target: **44×44px** (mobile-first default); 40px only in dense desktop data tables.
- ≥ **8px** spacing between adjacent targets (WCAG 2.5.8).
- When a control sits inside a larger target, the visual is ≥ 24px.

## Keyboard & focus

- Every interaction is keyboard + screen-reader complete.
- **Visible focus ring**: 2px `--wco-ring`, 2px offset, ≥ 3:1 contrast (do **not** remove the UA focus ring without an equivalent custom ring).
- Tab order follows visual order; a **"Skip to main content"** link is the first focusable element on every page (`.skip-link` in `globals.css`).

## Motion

- `prefers-reduced-motion` collapses all expressive travel to 0.01ms opacity cross-fades.
- `prefers-reduced-transparency` drops backdrop blur to solid surfaces.
- No infinite motion that implies travel.

## Media & images

- Lazy-load below the fold; AVIF/WebP with intrinsic sizes.
- Every image with meaning has `alt`; decorative images are empty/`aria-hidden`.
- Video (if used) has captions, transcript, and pause controls.

## Forms

- Every control has a visible label linked via `for`/`id`, plus `aria-describedby` for help/error text.
- Validation errors are announced (`role="alert"`), linked to the field, and never rely on color alone.
- Smart/AI validation still communicates the same way — it never substitutes an inaccessible pattern.

## Async & loading

- Real-shape skeletons (not spinners) for async lists.
- Every async action has success/error/offline states with retry.
- `aria-live` regions announce meaningful async changes.

## ARIA roles (canonical)

`button`, `link`, `dialog` (modal + focus trap + Escape + restore focus), `alert`, `status`, `tablist`, `listbox`, `combobox`, real `<table>` with `<th scope>`. See `accessibility.roles`.

## Screen-reader-only utility

`accessibility.srOnly` provides the clip-based `sr-only` style used by skip-links and visually-hidden labels.

## The PR checklist (enforce every PR)

1. All text/surface pairs meet AAA in light **and** dark.
2. Every interactive element is keyboard + screen-reader reachable.
3. Every interactive element shows a ≥ 3:1 visible focus ring.
4. Every touch target ≥ 44px, ≥ 8px between targets.
5. `prefers-reduced-motion` collapses all expressive travel.
6. All async surfaces expose real-shape skeleton + error/retry.
7. Tab order matches visual order; a skip-link is present.
8. Form controls have visible labels + `aria-describedby`.

Automate: axe-core in CI + Vitest component tests asserting roles/ARIA/keyboard (see [Implementation](./implementation.md)).
