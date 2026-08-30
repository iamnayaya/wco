/**
 * WCO Motion — accessibility guardrails.
 *
 * The JS engine already honors reduced-motion through `MotionProvider`. This
 * module covers the rest of the a11y surface: an SSR-safe OS-preference read,
 * a live hook, a plain "should we animate at all?" predicate, and pure helpers
 * for *declarative* (CSS animation/transition) authors to collapse motion-safe
 * changes when the user has asked for less movement.
 */
import type { CSSProperties } from 'react';
import { useMediaQuery } from '../lib/hooks';
import type { MotionStyleValues } from './core';
import type { MotionPrefs } from './values';

/** The standard query; kept in one place so tests and consumers share it. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * SSR-safe one-shot read of the OS preference. Returns `false` whenever the
 * preference is unknown (server render, or a host without `matchMedia`), which
 * keeps the default experience animated without layout shift.
 */
export function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Live reduced-motion flag, independent of `<MotionProvider>`. Same contract
 * as `useReducedMotionPref` but reads the OS directly (no context required).
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY, false);
}

/**
 * Headless guard: given a `MotionPrefs`-shaped object, report whether any
 * animation is appropriate at all. Zero cost, perfect for CSS animation
 * authors who want to bail out of an inline GIF-style keyframe loop.
 */
export function shouldAnimate(prefs: Pick<MotionPrefs, 'reduced' | 'frozen' | 'rate'>): boolean {
  return !prefs.reduced && !prefs.frozen && prefs.rate > 0;
}

/**
 * Declarative reducer: under reduced motion, strip `animation`/`transition`/
 * `willChange` from an inline style so CSS loops don't run, while keeping all
 * layout-critical properties untouched.
 */
export function motionSafeStyle(reduced: boolean, style?: CSSProperties): CSSProperties {
  if (!reduced) return style ?? {};
  const { animation, transition, willChange, ...rest } = style ?? {};
  void animation;
  void transition;
  void willChange;
  return rest;
}

/**
 * Collapse animated `MotionStyleValues` onto their resting state — opacity 1,
 * no transform, no filter. Feed this to a `from`/`to` (or the equivalent of a
 * motion value snapshot) under reduced motion so elements sit at rest instead
 * of traveling from an off-state.
 */
export function collapseMotion(values: MotionStyleValues): MotionStyleValues {
  const out: MotionStyleValues = {};
  for (const key of Object.keys(values) as Array<keyof MotionStyleValues>) {
    switch (key) {
      case 'opacity':
        out.opacity = 1;
        break;
      case 'scale':
      case 'scaleX':
      case 'scaleY':
        out[key] = 1;
        break;
      case 'x':
      case 'y':
      case 'rotate':
      case 'rotateX':
      case 'rotateY':
      case 'blur':
      case 'grayscale':
      case 'sepia':
        out[key] = 0;
        break;
      case 'brightness':
        out.brightness = 1;
        break;
    }
  }
  return out;
}