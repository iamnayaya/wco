/**
 * WCO Spacing, Radii, Elevation & Motion tokens.
 *
 * Spacing: a 4px base unit → 24-step scale. Every gap, padding and margin is
 * drawn from this scale (no ad-hoc px). The scale is deliberately
 * "clustered" at the small end because most rhythm happens in 4–16px increments;
 * the leap units (24/32/40) dominate page-level rhythm.
 *
 * Radii: soft but not "pill-overload". We use a small set with an explicit
 * `full` (pill) for badges/pills only, keeping surfaces feeling crafted not
 * cartoonish.
 *
 * Elevation: layered shadows that read as "crisp + light" in light mode and
 * are replaced by surface-tone contrast (no heavy black drops) in dark mode.
 *
 * Motion: durations & easings in a scaled set. See docs/design-system/animation
 * for the rules that govern *why* each value is used.
 */

/** 4px-based spacing scale (px values). */
export const spacing: Readonly<Record<string, string>> = {
  px: '1px',
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  18: '72px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
};

/** Core rhythm helpers (semantic aliases, px strings). */
export const space = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '40px',
  '2xl': '64px',
  '3xl': '96px',
} as const;

/** Border radii. */
export const radii: Readonly<Record<string, string>> = {
  none: '0px',
  sm: '6px',
  md: '10px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '9999px',
} as const;

export const radius = {
  none: radii.none,
  sm: radii.sm,
  md: radii.md,
  lg: radii.lg,
  xl: radii.xl,
  full: radii.full,
} as const;

/** Elevation shadows (light-mode tuned; dark mode relies on surface tints). */
export const shadows: Readonly<Record<string, string>> = {
  card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
  raised: '0 4px 8px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
  popover:
    '0 12px 24px -6px rgb(0 0 0 / 0.14), 0 4px 8px -4px rgb(0 0 0 / 0.1)',
  modal:
    '0 24px 48px -12px rgb(0 0 0 / 0.25), 0 8px 16px -8px rgb(0 0 0 / 0.12)',
  focus: '0 0 0 3px rgb(5 150 105 / 0.25)', // brand 600 @ 25%
} as const;

/**
 * Motion durations & easings.
 * Durations grow with the "distance/expressiveness" of the change.
 * Easings: standard = the workhorse; emphasized = entrance; exit is slightly
 * steeper to feel decisive; springy reserved for delight moments.
 */
export const duration = {
  instant: '0ms',
  fast: '120ms',
  base: '200ms',
  moderate: '280ms',
  slow: '400ms',
  slower: '650ms',
  deliberate: '900ms',
} as const;

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  springy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  linear: 'linear',
} as const;

/** Named motion presets (referenced by docs/design-system/animation). */
export const motion = {
  fastIn: { duration: duration.fast, easing: easing.emphasized },
  standard: { duration: duration.base, easing: easing.standard },
  moderate: { duration: duration.moderate, easing: easing.standard },
  exit: { duration: duration.fast, easing: easing.exit },
  springIn: { duration: duration.moderate, easing: easing.springy },
} as const;

export type WcoLayoutTokens = {
  spacing: typeof spacing;
  space: typeof space;
  radii: typeof radii;
  radius: typeof radius;
  shadows: typeof shadows;
  duration: typeof duration;
  easing: typeof easing;
  motion: typeof motion;
};

export const layout: WcoLayoutTokens = {
  spacing,
  space,
  radii,
  radius,
  shadows,
  duration,
  easing,
  motion,
};
