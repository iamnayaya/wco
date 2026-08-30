/**
 * WCO Typography System — "Clear at a glance, calm at a scan."
 *
 * Voice: Inter is the primary UI + body font (already the repo standard via
 * `--font-inter`), selected because it reads superbly at small sizes and in a
 * wide range of scripts/rendering contexts — important when merchants set
 * phone font-size to "Large" and view in direct light.
 *
 * This file codifies:
 * - `fonts` — family stacks (sans + a monospace for code/data)
 * - `weights` — 100–900 (only 400/500/600/700 are used in practice; others
 *   defined so variable-font users get the full ramp)
 * - `sizes` — fluid modular scale via clamp() so type scales continuously
 *   between a phone and a desktop panel (no jarring breakpoint jumps)
 * - `lineHeights`, `letterSpacing`, `paragraphSpacing`, `headings`
 *
 * Fluid type rule: `clamp(min, preferred = vw·factor, max)`.
 * The two master sizes — `base16` (body) and `display72` (hero) — move with
 * the viewport; the in-between steps are authored to sit on the same curve so
 * hierarchy stays proportional at every width.
 */

export const fonts = {
  sans: [
    'var(--font-inter)',
    'Inter',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ] as const,
  mono: [
    'ui-monospace',
    'SFMono-Regular',
    'SF Mono',
    'Menlo',
    'Consolas',
    'Liberation Mono',
    'monospace',
  ] as const,
} as const;

export const weights = {
  thin: 100,
  extraLight: 200,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extraBold: 800,
  black: 900,
} as const;

/**
 * Fluid type scale. Each entry: `{ size, mobile, desktop }` where `size` is
 * the clamp() expression and `mobile`/`desktop` document the anchor px for
 * readability review.
 *
 * Naming matches Tailwind keys so the config can map 1:1.
 */
export const sizes: Record<string, { size: string; mobile: number; desktop: number }> = {
  // Display / hero
  display: { size: 'clamp(2.75rem, 8vw, 4.5rem)', mobile: 44, desktop: 72 },
  'display-sm': { size: 'clamp(2.25rem, 6vw, 3.5rem)', mobile: 36, desktop: 56 },

  // Headings
  h1: { size: 'clamp(1.875rem, 4vw, 2.5rem)', mobile: 30, desktop: 40 },
  h2: { size: 'clamp(1.5rem, 3.2vw, 2rem)', mobile: 24, desktop: 32 },
  h3: { size: 'clamp(1.25rem, 2.6vw, 1.625rem)', mobile: 20, desktop: 26 },
  h4: { size: 'clamp(1.125rem, 2vw, 1.375rem)', mobile: 18, desktop: 22 },

  // Body & UI
  lg: { size: 'clamp(1.125rem, 1.6vw, 1.25rem)', mobile: 18, desktop: 20 },
  base: { size: 'clamp(0.9375rem, 1vw, 1rem)', mobile: 15, desktop: 16 },
  sm: { size: 'clamp(0.8125rem, 0.9vw, 0.875rem)', mobile: 13, desktop: 14 },
  xs: { size: 'clamp(0.6875rem, 0.7vw, 0.75rem)', mobile: 11, desktop: 12 },
  '2xs': { size: 'clamp(0.625rem, 0.6vw, 0.6875rem)', mobile: 10, desktop: 11 },

  // Inter data-heavy tables / code labels (monospace-friendly)
  'data-sm': { size: 'clamp(0.75rem, 0.8vw, 0.8125rem)', mobile: 12, desktop: 13 },
} as const;

/** Line heights tuned for readability, keyed to the same names as `sizes`. */
export const lineHeights: Record<string, string> = {
  display: '1.05',
  'display-sm': '1.1',
  h1: '1.15',
  h2: '1.2',
  h3: '1.25',
  h4: '1.3',
  lg: '1.55',
  base: '1.6',
  sm: '1.55',
  xs: '1.5',
  '2xs': '1.45',
  'data-sm': '1.5',
} as const;

/**
 * Letter spacing. Positive values loosen large headings (more legible and
 * "premium"), negative/zero normalize body so it doesn't shimmer on mobile.
 */
export const letterSpacing: Record<string, string> = {
  display: '-0.02em',
  'display-sm': '-0.015em',
  h1: '-0.01em',
  h2: '-0.01em',
  h3: '0',
  h4: '0',
  lg: '0',
  base: '0',
  sm: '0',
  xs: '0.01em',
  '2xs': '0.02em',
  'data-sm': '0',
} as const;

/** Spacing between successive paragraphs within a block of body text. */
export const paragraphSpacing = {
  base: '0.75rem', // 12px at 16px font
  sm: '0.625rem',
  lg: '1rem',
} as const;

/** The heading hierarchy (documented in one place for H1–H6 parity). */
export const headings = {
  h1: { size: sizes.h1.size, weight: weights.bold, lineHeight: lineHeights.h1 },
  h2: { size: sizes.h2.size, weight: weights.semibold, lineHeight: lineHeights.h2 },
  h3: { size: sizes.h3.size, weight: weights.semibold, lineHeight: lineHeights.h3 },
  h4: { size: sizes.h4.size, weight: weights.semibold, lineHeight: lineHeights.h4 },
  h5: { size: sizes.lg.size, weight: weights.semibold, lineHeight: lineHeights.lg },
  h6: { size: sizes.base.size, weight: weights.semibold, lineHeight: lineHeights.base },
} as const;

/** Short helper that returns a Tailwind-safe clamp string for a named step. */
export function typeClamp(name: keyof typeof sizes): string {
  return sizes[name].size;
}

export type WcoTypeTokens = {
  fonts: typeof fonts;
  weights: typeof weights;
  sizes: typeof sizes;
  lineHeights: typeof lineHeights;
  letterSpacing: typeof letterSpacing;
  paragraphSpacing: typeof paragraphSpacing;
  headings: typeof headings;
};

export const typography: WcoTypeTokens = {
  fonts,
  weights,
  sizes,
  lineHeights,
  letterSpacing,
  paragraphSpacing,
  headings,
};
