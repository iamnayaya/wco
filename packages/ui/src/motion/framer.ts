/**
 * WCO Motion — Framer Motion adapter.
 *
 * A pure, dependency-free shim that translates WCO Motion vocabulary (presets,
 * easings, springs, loop choreography) into plain objects shaped for Framer
 * Motion's `transition` and `variants` APIs. No import of `framer-motion` is
 * performed here, so the module (and therefore the package) never demands the
 * dependency; hand the returned objects to Framer in the app shell.
 */
import type { Easing } from './core';
import type { MotionStyleValues } from './core';
import { resolvePreset, type LoopMode, type PresetSpec, type SpringSpec } from './tokens';
import type { SpringParams } from './physics';

/** A spring config in Framer's per-axis vocabulary. */
export interface FramerSpringTransition {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass: number;
  restDelta?: number;
}

/** Framer-accepted easing: named string, cubic bezier, or a function. */
export type FramerEasing = string | readonly [number, number, number, number] | ((t: number) => number);

/** Framer-accepted transition object. */
export interface FramerTransition {
  type: 'tween' | 'spring';
  duration?: number;
  delay?: number;
  ease?: FramerEasing;
  repeat?: number | typeof Infinity;
  repeatType?: 'loop' | 'mirror' | 'reverse';
  stiffness?: number;
  damping?: number;
  mass?: number;
}

/** Variants pair derived from a WCO preset, ready for `animate` on Framer. */
export interface FramerVariants {
  hidden: MotionStyleValues;
  visible: MotionStyleValues;
  transition: FramerTransition;
}

/** Map named easings Framer already ships; fall back to a bezier equivalent. */
const EASE_NAMES: Record<string, FramerEasing> = {
  linear: 'linear',
  in: 'easeIn',
  out: 'easeOut',
  inOut: 'easeInOut',
  circIn: 'circIn',
  circOut: 'circOut',
  circInOut: 'circInOut',
  backIn: 'backIn',
  backOut: 'backOut',
  anticipate: 'anticipate',
  elasticOut: [0.16, 1, 0.3, 1],
  bounceOut: [0.22, 1, 0.36, 1],
};

/** Map elastic/bounce-only names onto a close bezier. */
export function easingToFramer(ease: Easing): FramerEasing {
  if (typeof ease === 'function') return ease;
  if (Array.isArray(ease)) return ease;
  return EASE_NAMES[ease] ?? 'easeOut';
}

/** Convert a WCO `SpringParams` into Framer's spring transition shape. */
export function springToFramer(params: SpringParams = {}): FramerSpringTransition {
  return {
    type: 'spring',
    stiffness: params.stiffness ?? 170,
    damping: params.damping ?? 26,
    mass: params.mass ?? 1,
    ...(params.restDelta !== undefined ? { restDelta: params.restDelta } : {}),
  };
}

/**
 * Framer repeat choreography from WCO loop semantics. Framer's `repeat` counts
 * *additional* iterations, so WCO's `counts` (total) maps to `counts - 1`.
 */
export function loopToFramer(
  loop: LoopMode,
  counts = 0,
): Pick<FramerTransition, 'repeat' | 'repeatType'> | undefined {
  if (loop === 'none' || loop === 'once') return undefined;
  const repeatType = loop === 'mirror' ? 'mirror' : 'loop';
  const repeat: number = counts === 0 ? Infinity : Math.max(0, counts - 1);
  return repeat === 0 ? undefined : { repeat, repeatType };
}

/** Translate a full WCO preset spec into a Framer transition object. */
export function transitionToFramer(spec: PresetSpec): FramerTransition {
  if (spec.mode === 'spring') {
    const springCfg: SpringSpec = spec.spring ?? ({} as SpringSpec);
    return {
      type: 'spring',
      stiffness: springCfg.stiffness ?? 170,
      damping: springCfg.damping ?? 26,
      mass: springCfg.mass ?? 1,
      delay: spec.delay,
    };
  }
  return {
    type: 'tween',
    duration: spec.duration ?? 320,
    delay: spec.delay,
    ease: easingToFramer(spec.ease ?? 'out'),
    ...loopToFramer(spec.loop ?? 'none', spec.counts),
  };
}

/**
 * Derive `hidden`/`visible` variants for Framer from a WCO preset name or a
 * raw spec. Missing keys resolve to rest; the transition peaks at the spec.
 */
export function presetToFramer(preset: string | PresetSpec): FramerVariants {
  const spec = typeof preset === 'string' ? resolvePreset(preset) : preset;
  return {
    hidden: spec.from ?? { opacity: 0 },
    visible: spec.to ?? {},
    transition: transitionToFramer(spec),
  };
}