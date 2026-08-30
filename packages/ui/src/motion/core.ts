import type { CSSProperties } from 'react';

/**
 * WCO Motion — core mathematics.
 *
 * This module is entirely side-effect free (pure functions + data) so the
 * whole physics/easing/preset layer is trivially testable and safe to run
 * on any runtime (browser, jsdom, SSR). The only DOM contact lives in the
 * frame driver (`motion/raf.ts`) and the React layers.
 */

/** Named easings. Mirrors the feel of Framer's presets but pure-local. */
export type EasingName =
  | 'linear'
  | 'in'
  | 'out'
  | 'inOut'
  | 'circIn'
  | 'circOut'
  | 'circInOut'
  | 'backIn'
  | 'backOut'
  | 'anticipate'
  | 'elasticOut'
  | 'bounceOut';

export type Easing = EasingName | [number, number, number, number] | ((t: number) => number);
export type EasingFn = (t: number) => number;

/* ------------------------------ math atoms ------------------------------ */

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export const round2 = (v: number) => Math.round(v * 100) / 100;

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Ping-pong a value in [0,1] back and forth across `periods`. */
export const pingpong = (t: number, periods = 1) => {
  const s = (t / periods) % 1;
  return s < 0.5 ? s * 2 : 2 - s * 2;
};

/* ------------------------------- easing ------------------------------- */

const BEZIERS: Record<EasingName, [number, number, number, number] | null> = {
  linear: [0, 0, 1, 1],
  in: [0.42, 0, 1, 1],
  out: [0, 0, 0.58, 1],
  inOut: [0.42, 0, 0.58, 1],
  circIn: [0.55, 0, 1, 0.45],
  circOut: [0, 0.55, 0.45, 1],
  circInOut: [0.85, 0, 0.15, 1],
  backIn: [0.36, -0.2, 0.36, 1],
  backOut: [0.34, 1.56, 0.64, 1],
  anticipate: [0.68, -0.6, 0.32, 1.6],
  elasticOut: null,
  bounceOut: null,
};

function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  return (t: number) => {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sample = (x: number) => ((ax * x + bx) * x + cx) * x;
    const sampleDeriv = (x: number) => (3 * ax * x + 2 * bx) * x + cx;
    let x = t;
    for (let i = 0; i < 8; i += 1) {
      const err = sample(x) - t;
      if (Math.abs(err) < 1e-6) break;
      const d = sampleDeriv(x);
      x -= d === 0 ? 0 : err / d;
    }
    return ((ay * x + by) * x + cy) * x;
  };
}

/** Overshoots past 1 then settles (spring-flavoured, zero-cost). */
const backOutFn: EasingFn = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const backInFn: EasingFn = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
};

/** Elastic — overshoots around the target with a decaying oscillation. */
const elasticOutFn: EasingFn = (t) => {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** Bounce — four discrete impacts, each shorter than the last. */
const bounceOutFn: EasingFn = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

/** Resolve any `Easing` spec into a pure function of progress [0,1]. */
export function resolveEasing(ease: Easing = 'out'): EasingFn {
  if (typeof ease === 'function') return ease;
  if (Array.isArray(ease)) return cubicBezier(ease[0], ease[1], ease[2], ease[3]);
  if (ease === 'elasticOut') return elasticOutFn;
  if (ease === 'bounceOut') return bounceOutFn;
  if (ease === 'backOut') return backOutFn;
  if (ease === 'backIn') return backInFn;
  const b = BEZIERS[ease] ?? (BEZIERS.out as [number, number, number, number]);
  return cubicBezier(b[0], b[1], b[2], b[3]);
}

/* ---------------------------- [0..1] → [a..b] ---------------------------- */

export interface InterpolateOptions {
  ease?: Easing;
  clamp?: boolean;
}

/** Map progress [0,1] onto `[a,b]` through an optional easing. */
export function interpolate(a: number, b: number, progress: number, opts: InterpolateOptions = {}): number {
  const t = resolveEasing(opts.ease)(progress);
  return mix(a, b, opts.clamp === false ? t : clamp(t, 0, 1));
}

/**
 * Keyframe spline: `points` define numbers at normalized `at` positions; the
 * result maps progress [0,1] to the interpolated value with per-segment easing.
 */
export function interpolateKeyframes(
  points: ReadonlyArray<{ at: number; value: number; ease?: Easing }>,
  progress: number,
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].value;
  const sorted = [...points].sort((a, b) => a.at - b.at);
  if (progress <= sorted[0].at) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (progress >= last.at) return last.value;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const p = sorted[i];
    const n = sorted[i + 1];
    if (progress >= p.at && progress <= n.at) {
      const span = n.at - p.at || 1;
      return interpolate(p.value, n.value, (progress - p.at) / span, { ease: n.ease ?? p.ease ?? 'linear', clamp: false });
    }
  }
  return last.value;
}

/** Resolve a duration overrides table to a millisecond number. */
export function resolveDuration(duration: number): number {
  return Math.max(0, duration);
}

/* ----------------------------- motion values ---------------------------- */

/** A subscribable value. Numeric by default — the currency of motion. */
export class MotionValue<T = number> {
  private current: T;
  private listeners = new Set<(v: T) => void>();

  constructor(initial: T) {
    this.current = initial;
  }

  get(): T {
    return this.current;
  }

  set(next: T): void {
    if (Object.is(next, this.current)) return;
    this.current = next;
    for (const fn of this.listeners) fn(next);
  }

  subscribe(fn: (v: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Drop all subscribers. Safe to call on unmount. */
  reset(): void {
    this.listeners.clear();
  }
}

export type MotionStyleValues = {
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
  opacity?: number;
  blur?: number;
  grayscale?: number;
  sepia?: number;
  brightness?: number;
};

/**
 * Compose a GPU-friendly transform + filter string. Only `transform` and
 * `opacity` are animated at runtime; everything visual is a pure projection.
 */
export function buildTransform(v: MotionStyleValues): string {
  const x = round2(v.x ?? 0);
  const y = round2(v.y ?? 0);
  const scaleX = round2(v.scaleX ?? v.scale ?? 1);
  const scaleY = round2(v.scaleY ?? v.scale ?? 1);
  const rotate = round2(v.rotate ?? 0);
  const rotateX = round2(v.rotateX ?? 0);
  const rotateY = round2(v.rotateY ?? 0);
  return [
    `translate3d(${x}px, ${y}px, 0)`,
    `scale(${scaleX}, ${scaleY})`,
    rotate ? `rotate(${rotate}deg)` : '',
    rotateX ? `rotateX(${rotateX}deg)` : '',
    rotateY ? `rotateY(${rotateY}deg)` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildFilter(v: MotionStyleValues): string {
  const parts: string[] = [];
  if (v.blur) parts.push(`blur(${round2(v.blur)}px)`);
  if (v.grayscale) parts.push(`grayscale(${clamp(v.grayscale)})`);
  if (v.sepia) parts.push(`sepia(${clamp(v.sepia)})`);
  if (v.brightness && v.brightness !== 1) parts.push(`brightness(${round2(v.brightness)})`);
  return parts.join(' ');
}

/** Full visual projection used to style animated elements. */
export function buildMotionStyle(v: MotionStyleValues, extra?: CSSProperties): CSSProperties {
  const transform = buildTransform(v);
  const filter = buildFilter(v);
  const style: CSSProperties = {
    transform,
    willChange: 'transform, opacity',
  };
  if (v.opacity !== undefined) style.opacity = round2(v.opacity);
  if (filter) style.filter = filter;
  return { ...style, ...extra };
}