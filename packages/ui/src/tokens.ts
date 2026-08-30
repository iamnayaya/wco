/**
 * WCO design tokens — legacy flat map.
 *
 * Kept for backward compatibility. New code should import from
 * `./design-tokens` for the full system; this object is derived from it and
 * mirrors the old surface (`color.brand`, `radius.*`, etc.).
 */

import { brand, semantic, neutral } from './design-tokens/color';
import { radii } from './design-tokens/layout';

export const tokens = {
  color: {
    brand: brand['600'],
    brandDark: brand['700'],
    surface: neutral['50'],
    ink: neutral['900'],
    muted: neutral['500'],
    danger: semantic.danger.DEFAULT,
    warning: semantic.warning.DEFAULT,
  },
  radius: { sm: radii.sm, md: radii.md, lg: radii.lg },
} as const;

export type WcoTokens = typeof tokens;
