/**
 * WCO Accessibility System — "Accessible by design, not by audit."
 *
 * We target WCAG 2.1 AAA (≥ 7:1 body, ≥ 4.5:1 large, ≥ 3:1 UI) in *both*
 * themes, plus perceivability, operability, and robustness beyond the spec.
 * This file codifies the guarantees, the touch/gesture contract, and the
 * helpers teams use to enforce it in every PR.
 *
 * This file codifies:
 * - `contrast`    — the AAA contrast guarantees for every semantic surface.
 * - `touch`       — minimum touch target & spacing (44×44, 8px separations).
 * - `focus`       — the visible-focus contract + step order.
 * - `motion`      — reduced-motion mapping (see design-tokens/animation).
 * - `reducedData` — the low-data/offline-first contract (3G, data saver).
 * - `srOnly`      — the screen-reader-only utility.
 * - `roles`       — canonical ARIA roles & patterns per component family.
 * - `checklist`   — the reusable PR acceptance checklist.
 */

/** AAA contrast guarantees (normal text = ≥ 7:1 unless noted). */
export const contrast = {
  body: '≥ 7.0 : 1', // normal text on the app background
  bodyMuted: '≥ 7.0 : 1', // muted/description text — must still meet AAA
  bodyFaint: '≥ 4.5 : 1', // placeholder/large only — exempt from AAA for 11px, kept AA+ for readability
  largeText: '≥ 4.5 : 1', // large (≥ 24px / 19px bold)
  uiLarge: '≥ 3.0 : 1', // large UI components (buttons, hit-boxes)
  focus: '3px CanvasText', // hard, high-contrast focus indicator
} as const;

/** Touch & pointer contract (WCAG 2.5.5 target size + Spacing). */
export const touch = {
  minTarget: 44, // px — mobile-first default
  minTargetDense: 40, // px — desktop/data-dense only (still ≥ 24)
  spacing: 8, // px between adjacent targets (WCAG 2.5.8 minimum spacing)
  gestureTarget: 24, // px — when a target is within a larger target
  keyboard: 'Full 100% keyboard reachability & visible focus',
} as const;

/** Visible-focus order + rendering contract. */
export const focus = {
  step1: 'Remove default UA outline only where a custom ring replaces it.',
  step2: 'Render a 2px solid `--wco-ring` ring with 2px offset.',
  step3: 'Ring must contrast ≥ 3:1 against adjacent colors AND background.',
  order: 'Tab order follows visual order, top-left → bottom-right, in every layout.',
  skipLink: 'A "Skip to main content" link must be the first focusable element.',
} as const;

/** Reduced-motion contract — see design-tokens/animation.reducedMotion. */
export const motion = {
  reduced: 'Collapse all travel to 0.01ms opacity cross-fade.',
  safeTransforms: 'Opacity + color are the only safe affected properties.',
  infinite: 'No infinite animations that imply motion (pulse may pause).',
} as const;

/** Reduced-data / offline-first contract. */
export const reducedData = {
  weight: 'First-paint < 14KB render-critical CSS; no render-blocking webfonts on 3G.',
  images: 'Lazy-load below the fold; AVIF/WebP with intrinsic sizes.',
  fallback: 'Every async surface has a usable offline/error state.',
  skeleton: 'Use real-shape skeletons, not spinners, for async lists.',
} as const;

/** Screen-reader-only utility (styles to paste or apply). */
export const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
} as const;

/** Canonical ARIA roles & patterns per component family. */
export const roles = {
  button: 'button',
  link: { role: 'link', hint: 'Clear on "open in new tab" + external icon.' },
  dialog: { role: 'dialog', ariaModal: true, hint: 'Focus trap + escape + restore focus.' },
  alert: 'alert',
  status: 'status',
  tablist: 'tablist',
  form: { hint: 'Label every control; `aria-describedby` for help text.' },
  table: { hint: 'Real `<table>` with `<th scope>` — never div tables.' },
  listbox: 'listbox',
  combobox: 'combobox',
} as const;

/** The reusable PR acceptance checklist (mirrors docs/design-system/accessibility). */
export const checklist = [
  'All text/surface pairs meet AAA in light AND dark.',
  'Every interactive element is keyboard + screen-reader reachable.',
  'Every interactive element shows a ≥ 3:1 visible focus ring.',
  'Every touch target ≥ 44px, with ≥ 8px between targets.',
  '`prefers-reduced-motion` collapses all expressive travel.',
  'All async surfaces expose real-shape skeleton + error/retry.',
  'Tab order matches visual order; a skip-link is present.',
  'Form controls have visible labels + description (aria-describedby).',
] as const;

export type WcoAccessibilityTokens = {
  contrast: typeof contrast;
  touch: typeof touch;
  focus: typeof focus;
  motion: typeof motion;
  reducedData: typeof reducedData;
  srOnly: typeof srOnly;
  roles: typeof roles;
  checklist: typeof checklist;
};

export const accessibility = {
  contrast,
  touch,
  focus,
  motion,
  reducedData,
  srOnly,
  roles,
  checklist,
} as const;
