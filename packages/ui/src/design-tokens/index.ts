/**
 * WCO Design Tokens — unified entry point.
 *
 * This is the single source of truth for every foundation token. Consumers:
 * - `apps/frontend/tailwind.config.ts` maps these into Tailwind utilities.
 * - `packages/ui/src/components.tsx` uses them for the runtime primitives.
 * - Mobile (React Native) mirrors the raw hex values via an export map.
 *
 * Backward-compat: `tokens` (the legacy flat map from `./tokens`) is preserved
 * and now derived from this system so existing imports keep working.
 */

/** Core foundations (no name collisions among these three). */
export * from './color';
export * from './typography';
export * from './layout';

/**
 * Extended foundations. Re-exported explicitly (not `export *`) because a few
 * friendly names (`motion`, `animation`, `sizes`, `weights`, `focus`,
 * `cultural`) are shared by more than one module. Alias where needed; the
 * canonical objects (`animation.*`, `icons.*`, etc.) are always available.
 */
export {
  durations,
  easings,
  steps,
  keyframes,
  reducedMotion,
  principles,
  animation,
  type DurationName,
  type EasingName,
  type WcoAnimationTokens,
} from './animation';

export {
  names as iconNames,
  sizes as iconSizes,
  weights as iconWeights,
  states as iconStates,
  animation as iconAnimation,
  icons,
  iconA11y,
  isIconName,
  type IconName,
  type IconSize,
  type IconWeight,
  type WcoIconTokens,
} from './icons';

export {
  breakpoints,
  media,
  grid,
  containers,
  whitespace,
  semantics,
  layoutSystem,
  gridFor,
  type Breakpoint,
  type Container as ContainerName,
  type WcoLayoutSystemTokens,
} from './layout-system';

export {
  gradients,
  blur,
  glass,
  dynamic,
  culturalRamp,
  focus as focusTokens,
  effects,
  type WcoEffectsTokens,
} from './effects';

export {
  contrast,
  touch,
  focus,
  motion as motionContract,
  reducedData,
  srOnly,
  roles,
  checklist,
  accessibility,
  type WcoAccessibilityTokens,
} from './accessibility';

import { colors } from './color';
import { typography } from './typography';
import { layout } from './layout';
import { animation } from './animation';
import { icons } from './icons';
import { layoutSystem } from './layout-system';
import { effects } from './effects';
import { accessibility } from './accessibility';

/** Top-level convenience export: everything in one object. */
export const designTokens = {
  color: colors,
  type: typography,
  layout,
  animation,
  icons,
  layoutSystem,
  effects,
  accessibility,
} as const;

export type DesignTokens = typeof designTokens;
