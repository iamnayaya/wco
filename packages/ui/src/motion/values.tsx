import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { clamp, interpolate, resolveEasing, MotionValue, buildMotionStyle, type Easing, type MotionStyleValues } from './core';
import { stepSpring, type SpringParams } from './physics';
import { subscribeFrame } from './raf';
import { useMediaQuery, useReducedMotion } from '../lib/hooks';
import type { LoopMode } from './tokens';

/**
 * WCO Motion — values & hooks.
 *
 * The React spine: a MotionProvider that owns the shared motion policy
 * (reduced-motion, rate scaling, freeze), MotionValue-backed animation
 * controllers (tween/spring/timeline/sequence), composition helpers
 * (stagger/cascade/count/cycle), and an imperative style binder that applies
 * GPU-friendly transforms directly to the DOM without re-rendering.
 */

export type { MotionValue, MotionStyleValues };

/* ------------------------------- provider ------------------------------- */

export interface MotionPrefs {
  /** OS-level: prefers-reduced-motion. Overridable by the provider. */
  reduced: boolean;
  /** Global playback rate (0 = frozen). Sub-second feel adjustments. */
  rate: number;
  /** Hard freeze — pauses every animation in the subtree. */
  frozen: boolean;
  /** Whether a consumer explicitly overrode the OS preference. */
  forced: boolean;
  setFrozen: (frozen: boolean) => void;
}

interface MotionContextValue {
  reduced: boolean;
  rate: number;
  frozen: boolean;
  forced: boolean;
  setReduced: (reduced: boolean) => void;
  setRate: (rate: number) => void;
  setFrozen: (frozen: boolean) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

export interface MotionProviderProps {
  /** Force reduced-motion on (true) or off (false); null inherits OS. */
  reduced?: boolean | null;
  /** Global rate multiplier (default 1). */
  rate?: number;
  /** Start frozen. */
  frozen?: boolean;
  children?: ReactNode;
}

export function MotionProvider({ reduced = null, rate = 1, frozen = false, children }: MotionProviderProps) {
  const osReduced = useReducedMotion();
  const [forced, setForced] = useState<boolean | null>(reduced ?? null);
  const [rateState, setRateState] = useState(rate);
  const [frozenState, setFrozen] = useState(frozen);

  useEffect(() => {
    setForced(reduced);
  }, [reduced]);

  const value = useMemo<MotionContextValue>(
    () => ({
      reduced: forced ?? osReduced,
      rate: rateState,
      frozen: frozenState,
      forced: forced !== null,
      setReduced: (r) => setForced(r),
      setRate: setRateState,
      setFrozen,
    }),
    [forced, osReduced, rateState, frozenState],
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

/** Read the current motion policy (falls back to OS preference). */
export function useMotionPrefs(): MotionPrefs {
  const ctx = useContext(MotionContext);
  const os = useReducedMotion();
  if (ctx) {
    return {
      reduced: ctx.reduced,
      rate: ctx.rate,
      frozen: ctx.frozen,
      forced: ctx.forced,
      setFrozen: ctx.setFrozen,
    };
  }
  return { reduced: os, rate: 1, frozen: false, forced: false, setFrozen: () => undefined };
}

/** Reactive reduced-motion flag composed from OS preference + provider. */
export function useReducedMotionPref(): boolean {
  const ctx = useContext(MotionContext);
  if (ctx) return ctx.reduced;
  return useMediaQuery('(prefers-reduced-motion: reduce)', false);
}

/** Stable ref mirroring prefs so rAF loops never go stale. */
function usePrefsRef(): { current: MotionPrefs } {
  const prefs = useMotionPrefs();
  const ref = useRef(prefs);
  useEffect(() => {
    ref.current = prefs;
  });
  return ref;
}

/* --------------------------- base motion values -------------------------- */

let uid = 0;

/** Stable MotionValue instance (target for animation or direct writes). */
export function useMotionValue<T>(initial: T): MotionValue<T> {
  const mv = useRef<MotionValue<T> | null>(null);
  if (mv.current === null) mv.current = new MotionValue(initial);
  return mv.current;
}

/** Re-render the component whenever an external MotionValue changes. */
export function useMotionValueRender<T>(mv: MotionValue<T>): T {
  return useSyncExternalStore(
    useCallback((onChange) => mv.subscribe(onChange) as () => void, [mv]),
    useCallback(() => mv.get(), [mv]),
  );
}

interface StyleBinderResult {
  ref: RefObject<HTMLElement | null>;
}

/** Generate an accessible name for a live styled region (helpful in lists). */
export function binderName(prefix = 'motion'): string {
  uid += 1;
  return `${prefix}-${uid}`;
}

/**
 * Apply numeric MotionValues to a DOM element's transform/filter/opacity each
 * time they change — zero re-renders. Attach the returned `ref` to the element.
 * The `extra` record is an immutable base (read at mount only).
 */
export function useMotionStyle(values: Record<string, MotionValue<number>>, extra?: MotionStyleValues): StyleBinderResult {
  const ref = useRef<HTMLElement | null>(null);
  const extraRef = useRef(extra);
  useEffect(() => {
    extraRef.current = extra;
  }, [extra]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const snapshot: MotionStyleValues = { ...(extraRef.current ?? {}) };
      for (const key of Object.keys(values)) {
        (snapshot as Record<string, number>)[key] = values[key].get();
      }
      const style = buildMotionStyle(snapshot);
      if (style.transform) el.style.transform = style.transform;
      if (style.opacity !== undefined) el.style.opacity = String(style.opacity);
      if (style.filter) el.style.filter = style.filter;
    };
    apply();
    const unsubs = Object.values(values).map((mv) => mv.subscribe(apply));
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [values]);

  return { ref };
}

function useFrameLoop(active: boolean, callback: (dt: number) => void): void {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  });
  useEffect(() => {
    if (!active) return;
    return subscribeFrame((_, dt) => cbRef.current(dt));
  }, [active]);
}

/* ------------------------------ tween engine ---------------------------- */

export interface TweenSpec {
  to: number;
  from?: number;
  duration?: number;
  delay?: number;
  ease?: Easing;
  loop?: LoopMode;
  counts?: number;
  autoStart?: boolean;
  onComplete?: () => void;
  onUpdate?: (value: number) => void;
}

export interface TweenController {
  value: MotionValue<number>;
  active: boolean;
  play: (overrides?: Partial<TweenSpec>) => void;
  stop: () => void;
  reset: () => void;
}

/** Deterministic, interruptible tween that respects the motion policy. */
export function useTween(initial: TweenSpec): TweenController {
  const prefsRef = usePrefsRef();
  const value = useMotionValue(initial.from ?? initial.to);
  const [active, setActive] = useState(false);

  const state = useRef({
    from: 0,
    to: 0,
    duration: 320,
    delayLeft: 0,
    elapsed: 0,
    ease: resolveEasing('out'),
    loop: 'none' as LoopMode,
    iterations: 0,
    remaining: 1,
    onComplete: undefined as (() => void) | undefined,
    onUpdate: undefined as ((v: number) => void) | undefined,
  });

  const latest = useRef(initial);
  useEffect(() => {
    latest.current = initial;
  });

  useFrameLoop(active, (dt) => {
    const s = state.current;
    const prefs = prefsRef.current;
    if (prefs.frozen || prefs.rate === 0) return;

    if (s.delayLeft > 0) {
      s.delayLeft -= dt * prefs.rate;
      return;
    }

    s.elapsed += dt * prefs.rate;
    const duration = Math.max(1, s.duration);
    let done = false;

    if (s.elapsed >= duration) {
      s.iterations += 1;
      if (s.loop === 'loop') {
        if (s.remaining !== 0 && s.iterations >= s.remaining) done = true;
        else s.elapsed = s.elapsed % duration;
      } else if (s.loop === 'mirror') {
        if (s.remaining !== 0 && s.iterations >= s.remaining) {
          done = true;
        } else {
          const tmp = s.from;
          s.from = s.to;
          s.to = tmp;
          s.elapsed = 0;
        }
      } else {
        done = true;
      }
    }

    if (done) {
      s.elapsed = duration;
      value.set(s.to);
      s.onUpdate?.(s.to);
      s.onComplete?.();
      setActive(false);
      return;
    }

    const t = Math.min(1, s.elapsed / duration);
    value.set(interpolate(s.from, s.to, s.ease(t), { ease: 'linear', clamp: false }));
    s.onUpdate?.(value.get());
  });

  const play = useCallback(
    (overrides?: Partial<TweenSpec>) => {
      const base = latest.current;
      const merged: TweenSpec = { ...base, ...overrides };
      const prefs = prefsRef.current;
      const from = merged.from ?? value.get();
      const to = merged.to;

      if (prefs.reduced || prefs.frozen) {
        value.set(to);
        merged.onUpdate?.(to);
        merged.onComplete?.();
        setActive(false);
        return;
      }

      const s = state.current;
      s.from = from;
      s.to = to;
      s.duration = merged.duration ?? 320;
      s.delayLeft = merged.delay ?? 0;
      s.elapsed = 0;
      s.ease = resolveEasing(merged.ease ?? 'out');
      s.loop = merged.loop ?? 'none';
      s.remaining = merged.counts ?? (merged.loop ? (merged.loop === 'none' ? 0 : merged.counts ?? 0) : 1);
      s.iterations = 0;
      s.onComplete = merged.onComplete;
      s.onUpdate = merged.onUpdate;
      value.set(from);
      merged.onUpdate?.(from);
      setActive(true);
    },
    [value],
  );

  const stop = useCallback(() => setActive(false), []);
  const reset = useCallback(() => {
    value.set(latest.current.from ?? latest.current.to);
    setActive(false);
  }, [value]);

  useEffect(() => {
    if (initial.autoStart === true) play();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { value, active, play, stop, reset };
}

/* ------------------------------ spring engine --------------------------- */

export type SpringHookOptions = SpringParams & {
  /** Snap instantly if |target − current| ≤ threshold (default 0). */
  threshold?: number;
};

function useSpringLoop(targetRef: { current: number }, value: MotionValue<number>, opts: SpringHookOptions): void {
  const prefsRef = usePrefsRef();
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  useFrameLoop(true, (dt) => {
    const prefs = prefsRef.current;
    const target = targetRef.current;
    const { threshold = 0 } = optsRef.current;
    const current = value.get();
    if (prefs.frozen || prefs.rate === 0) return;
    if (Math.abs(target - current) <= threshold) {
      value.set(target);
      return;
    }
    if (prefs.reduced) {
      value.set(target);
      return;
    }
    const r = stepSpring(current, 0, target, optsRef.current, dt * prefs.rate);
    value.set(r.atRest ? target : r.value);
  });
}

/** Chase a changing numeric target with a spring; returns an animated MotionValue. */
export function useSpring(target: number, opts: SpringHookOptions = {}): MotionValue<number> {
  const value = useMotionValue(target);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);
  useSpringLoop(targetRef, value, opts);
  return value;
}

/** Chase a flowing MotionValue target (e.g. scroll progress) with a spring. */
export function useSpringFrom(target: MotionValue<number>, opts: SpringHookOptions = {}): MotionValue<number> {
  const value = useMotionValue(target.get());
  const targetRef = useRef(target.get());
  useEffect(() => target.subscribe((v) => (targetRef.current = v)), [target]);
  useSpringLoop(targetRef, value, opts);
  return value;
}

export interface SpringObjectResult {
  values: Record<string, MotionValue<number>>;
  /** Attach to the element to receive the animated transform/opacity/filter. */
  style: StyleBinderResult;
  set: (key: string, v: number) => void;
}

/** Spring-animate a whole style record (position/scale/tilt) without re-renders. */
export function useSpringObject(initial: MotionStyleValues, opts: SpringHookOptions = {}, targets?: MotionStyleValues): SpringObjectResult {
  const keys = Object.keys(targets ?? initial);
  const values = useMemo(() => {
    const map: Record<string, MotionValue<number>> = {};
    for (const k of keys) map[k] = new MotionValue((initial as Record<string, number>)[k] ?? 0);
    return map;
  }, [initial, keys.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const targetsRef = useRef<MotionStyleValues>(targets ?? initial);
  useEffect(() => {
    targetsRef.current = targets ?? initial;
  });
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const prefsRef = usePrefsRef();

  useFrameLoop(true, (dt) => {
    const prefs = prefsRef.current;
    if (prefs.frozen || prefs.rate === 0) return;
    const tg = targetsRef.current as Record<string, number>;
    for (const k of keys) {
      const mv = values[k];
      const target = tg[k] ?? 0;
      if (prefs.reduced) {
        mv.set(target);
        continue;
      }
      const r = stepSpring(mv.get(), 0, target, optsRef.current, dt * prefs.rate);
      mv.set(r.atRest ? target : r.value);
    }
  });

  const style = useMotionStyle(values, {});
  const set = useCallback((key: string, v: number) => {
    targetsRef.current = { ...(targetsRef.current as Record<string, number>), [key]: v } as unknown as MotionStyleValues;
  }, []);
  return { values, style, set };
}

/* ------------------------------- timelines ------------------------------- */

export interface TimelineKeyframe {
  at: number;
  value: number;
  ease?: Easing;
}

export interface TimelineSpec {
  points: TimelineKeyframe[];
  duration?: number;
  autoStart?: boolean;
  loop?: boolean;
  onComplete?: () => void;
}

export interface TimelineController {
  value: MotionValue<number>;
  active: boolean;
  play: (overrides?: Partial<TimelineSpec>) => void;
  stop: () => void;
  reset: () => void;
}

/** Interpolate a normalized timeline: value follows the keyframe spline. */
export function timelineValueAt(points: TimelineKeyframe[], t: number): number {
  const sorted = [...points].sort((a, b) => a.at - b.at);
  if (sorted.length === 0) return 0;
  if (t <= sorted[0].at) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (t >= last.at) return last.value;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.at && t <= b.at) {
      const span = b.at - a.at || 1;
      return interpolate(a.value, b.value, (t - a.at) / span, { ease: a.ease ?? b.ease ?? 'linear', clamp: false });
    }
  }
  return last.value;
}

/** Multi-node value choreography driven by a normalized clock. */
export function useTimeline(spec: TimelineSpec): TimelineController {
  const value = useMotionValue(timelineValueAt(spec.points, 0));
  const [active, setActive] = useState(false);
  const state = useRef({ elapsed: 0, total: 1000, loop: false, onComplete: undefined as (() => void) | undefined });
  const specRef = useRef(spec);
  useEffect(() => {
    specRef.current = spec;
  }, [spec]);
  const prefsRef = usePrefsRef();

  useFrameLoop(active, (dt) => {
    const s = state.current;
    const prefs = prefsRef.current;
    if (prefs.frozen || prefs.rate === 0) return;
    s.elapsed += dt * prefs.rate;
    const t = s.total > 0 ? s.elapsed / s.total : 1;
    value.set(timelineValueAt(specRef.current.points, clamp(t)));
    if (t >= 1) {
      if (s.loop) {
        s.elapsed = 0;
      } else {
        s.onComplete?.();
        setActive(false);
      }
    }
  });

  const play = useCallback(
    (overrides?: Partial<TimelineSpec>) => {
      const merged = { ...specRef.current, ...overrides };
      const prefs = prefsRef.current;
      if (prefs.reduced || prefs.frozen) {
        value.set(timelineValueAt(merged.points, 1));
        merged.onComplete?.();
        setActive(false);
        return;
      }
      state.current = { elapsed: 0, total: Math.max(1, merged.duration ?? 1000), loop: merged.loop ?? false, onComplete: merged.onComplete };
      value.set(timelineValueAt(merged.points, 0));
      setActive(true);
    },
    [value],
  );

  const stop = useCallback(() => setActive(false), []);
  const reset = useCallback(() => {
    value.set(timelineValueAt(specRef.current.points, 0));
    setActive(false);
  }, [value]);

  useEffect(() => {
    if (spec.autoStart === true) play();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { value, active, play, stop, reset };
}

/* ------------------------------- sequence ------------------------------- */

export interface SequenceStep {
  to: number;
  from?: number;
  duration?: number;
  ease?: Easing;
}

export interface SequenceController {
  value: MotionValue<number>;
  active: boolean;
  play: () => void;
  stop: () => void;
  reset: () => void;
}

/** Run `steps` back-to-back; value holds the current absolute position. */
export function useSequence(steps: SequenceStep[]): SequenceController {
  const value = useMotionValue(steps[0]?.from ?? steps[0]?.to ?? 0);
  const [active, setActive] = useState(false);
  const state = useRef({ index: 0, elapsed: 0 });
  const listRef = useRef(steps);
  useEffect(() => {
    listRef.current = steps;
  });
  const prefsRef = usePrefsRef();

  useFrameLoop(active, (dt) => {
    const s = state.current;
    const list = listRef.current;
    const prefs = prefsRef.current;
    if (prefs.frozen || prefs.rate === 0) return;
    if (s.index >= list.length) {
      setActive(false);
      return;
    }
    const step = list[s.index];
    const from = step.from ?? (s.index > 0 ? list[s.index - 1].to : value.get());
    const duration = Math.max(1, step.duration ?? 320);
    const t = Math.min(1, s.elapsed / duration);
    value.set(interpolate(from, step.to, resolveEasing(step.ease ?? 'out')(t), { ease: 'linear', clamp: false }));
    s.elapsed += dt * prefs.rate;
    if (t >= 1) {
      value.set(step.to);
      s.index += 1;
      s.elapsed = 0;
    }
  });

  const play = useCallback(() => {
    const prefs = prefsRef.current;
    if (prefs.reduced || prefs.frozen) {
      value.set(listRef.current[listRef.current.length - 1]?.to ?? value.get());
      return;
    }
    state.current = { index: 0, elapsed: 0 };
    value.set(listRef.current[0]?.from ?? listRef.current[0]?.to ?? 0);
    setActive(true);
  }, [value]);

  const stop = useCallback(() => setActive(false), []);
  const reset = useCallback(() => {
    value.set(steps[0]?.from ?? steps[0]?.to ?? 0);
    state.current = { index: 0, elapsed: 0 };
    setActive(false);
  }, [steps, value]);

  return { value, active, play, stop, reset };
}

/* ------------------------- stagger / cascade / count -------------------- */

export interface StaggerOptions {
  count: number;
  interval?: number;
  delay?: number;
  from?: 'start' | 'middle' | 'end';
}

/** Precomputed stagger timings. `from: 'middle'` fans out from the centre. */
export function useStagger({ count, interval = 50, delay = 0, from = 'start' }: StaggerOptions): {
  delays: number[];
  total: number;
  at: (i: number) => number;
} {
  return useMemo(() => {
    const n = Math.max(0, count);
    const delays = Array.from({ length: n }, (_, i) => {
      if (from === 'end') return delay + (n - 1 - i) * interval;
      if (from === 'middle') return delay + Math.abs(i - (n - 1) / 2) * interval;
      return delay + i * interval;
    });
    const total = n > 0 ? delays[delays.length - 1] + 320 : 0;
    return { delays, total, at: (i) => delays[i] ?? 0 };
  }, [count, interval, delay, from]);
}

/** Detect when the bound element enters the viewport (IntersectionObserver-safe). */
export function useInView<T extends HTMLElement>(options: { once?: boolean; threshold?: number; rootMargin?: string } = {}): {
  ref: RefObject<T | null>;
  inView: boolean;
} {
  const { once = true, threshold = 0.2, rootMargin = '0px' } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const onceRef = useRef(once);
  useEffect(() => {
    onceRef.current = once;
  }, [once]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
          if (entry.isIntersecting && onceRef.current) io.unobserve(el);
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);

  return { ref, inView };
}

/** Stagger + intersection reveal in one: delays activate once the group is visible. */
export function useCascade<T extends HTMLElement>(count: number, opts: Omit<StaggerOptions, 'count'> & { once?: boolean; threshold?: number } = {}): {
  ref: RefObject<T | null>;
  visible: boolean;
  delays: number[];
} {
  const inView = useInView<T>({ once: opts.once ?? true, threshold: opts.threshold ?? 0.2 });
  const stagger = useStagger({ count, interval: opts.interval, delay: opts.delay, from: opts.from });
  return { ref: inView.ref, visible: inView.inView, delays: stagger.delays };
}

/** Animated counter that renders on a React clock (text needs real DOM). */
export function useCount(
  to: number,
  opts: { from?: number; duration?: number; delay?: number; ease?: Easing; format?: (n: number) => string } = {},
): { value: number; formatted: string; play: () => void; reset: () => void } {
  const { from = 0, duration = 1000, delay = 0, ease = 'out', format = (n) => String(Math.round(n)) } = opts;
  const [value, setValue] = useState(from);
  const controller = useTween({ from, to, duration, delay, ease, onUpdate: (v) => setValue(v) });
  return { value, formatted: format(value), play: controller.play, reset: controller.reset };
}

/** Cycle through an array of states, wrapping with an optional transform. */
export function useCycle<T, R = T>(values: ReadonlyArray<T>, transform: (v: T, index: number) => R = (v) => v as unknown as R): {
  state: R;
  index: number;
  next: () => void;
  prev: () => void;
  set: (index: number) => void;
} {
  const [index, setIndex] = useState(0);
  const n = Math.max(1, values.length);
  const next = useCallback(() => setIndex((i) => (i + 1) % n), [n]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + n) % n), [n]);
  const set = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);
  const state = values.length > 0 ? transform(values[index], index) : (transform as (v: never, i: number) => R)(undefined as never, 0);
  return { state, index, next, prev, set };
}