import type { CSSProperties } from 'react';
import { colors } from '../design-tokens/color';
import { radii, duration, easing } from '../design-tokens/layout';

/**
 * Theming bridge for the UI package.
 *
 * Components never hard-code color. They emit CSS custom-property references
 * with a triple fallback chain:
 *
 *   var(--wco-<name>)                    ← theme layer (globals.css, per theme)
 *     , var(--fallback-<name>, <hex>)    ← host bridge (globals.css :root/.dark)
 *     , <hex>                            ← light-mode design-token (standalone)
 *
 * That's how the same component is light-adaptive, dark-ready, and never
 * unstyled — even in a host that hasn't loaded the WCO theme stylesheet.
 */
/** camelCase token key → kebab-case CSS custom property name. */
function toVarName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function sem(name: keyof typeof colors.systemLight): string {
  const hex = colors.systemLight[name];
  const varName = toVarName(name);
  return `var(--wco-${varName}, var(--fallback-${varName}, ${hex}))`;
}

/** Same as `sem`, but falls back off the *dark* recipe (e.g. lifted primary). */
export function semDark(name: keyof typeof colors.systemDark): string {
  const hex = colors.systemDark[name];
  const varName = toVarName(name);
  return `var(--wco-${varName}, var(--fallback-${varName}, ${hex}))`;
}

/** Shared focus-visible ring — matches the a11y bar across the whole library. */
export const focusRing: CSSProperties = {
  outline: `2px solid ${sem('ring')}`,
  outlineOffset: '2px',
};

export const motion = {
  fast: `${duration.fast} ${easing.standard}`,
  base: `${duration.base} ${easing.standard}`,
} as const;

/** Control (input/button) sizes. `md` is the touch-first default (44px). */
export const controlSize = {
  sm: { height: 32, fontSize: 13, px: 10, gap: 6 },
  md: { height: 44, fontSize: 14, px: 14, gap: 8 },
  lg: { height: 52, fontSize: 15, px: 18, gap: 10 },
  xl: { height: 60, fontSize: 16, px: 22, gap: 12 },
} as const;

export type ControlSize = keyof typeof controlSize;

export const controlBorderRadius: Record<ControlSize, string> = {
  sm: radii.md,
  md: radii.md,
  lg: radii.lg,
  xl: radii.lg,
};

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';