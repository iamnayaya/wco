/**
 * WCO Motion — authored components.
 *
 * The hand-authored layer. `Animate` is the low-level "between two style
 * states" driver; every named entry component (Fade/Slide/Zoom/Flip/Rotate)
 * is a thin, opinionated facade over it. Higher-order components
 * (Stagger/Cascade/Reveal/Parallax) compose scroll + staggering, and utility
 * components (Spring/Tween/Timeline/CountUp/Skeleton/Ripple/Pressable/Shake/
 * ScrollToTop/ScrollProgressBar/Sticky) cover the everyday needs of a
 * design-system consumer. All animations are policy-aware: reduced-motion,
 * rate scaling and freeze come from the nearest MotionProvider.
 */
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { clamp, interpolate, resolveEasing, buildMotionStyle, type Easing, type EasingFn, type MotionStyleValues } from './core';
import { stepSpring, type SpringParams } from './physics';
import { subscribeFrame } from './raf';
import { resolvePreset, type LoopMode, type PresetSpec } from './tokens';
import {
  MotionProvider,
  useMotionPrefs,
  useMotionValue,
  useMotionValueRender,
  useMotionStyle,
  useSpringObject,
  useStagger,
  useCascade,
  useInView,
  useTimeline,
  useTween,
  useCount,
  type TimelineSpec,
} from './values';
import { useParallax, useScrolledPast, useScroll, useSticky, revealFrom } from './scroll';
import { useTap } from './gestures';

/* ------------------------------- shared bits ----------------------------- */

/** Identity ("rest") transform state so partial `from`/`to` bags fill in. */
const REST: Record<string, number> = {
  opacity: 1,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  x: 0,
  y: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  brightness: 1,
};

function unionKeys(a?: MotionStyleValues, b?: MotionStyleValues): string[] {
  return Array.from(new Set([...(Object.keys(a ?? {}) as string[]), ...(Object.keys(b ?? {}) as string[])]));
}

/** Interpolate a single style key between `from`/`to` at eased progress `t`. */
function mixKey(key: string, from?: MotionStyleValues, to?: MotionStyleValues, t = 1): number {
  const f = (from as Record<string, number> | undefined)?.[key] ?? REST[key] ?? 0;
  const g = (to as Record<string, number> | undefined)?.[key] ?? REST[key] ?? 0;
  return interpolate(f, g, t, { ease: 'linear' });
}

/* --------------------------------- Animate ------------------------------- */

export interface AnimateProps extends Omit<HTMLAttributes<HTMLElement>, 'onAnimationEnd' | 'onTransitionEnd' | 'onDrag'> {
  /** Render as this element (default `div`). */
  as?: ElementType;
  /** Author the full preset (e.g. `"pop"`, `"slideUp"`, `"shakeX"`). */
  preset?: string;
  /** Animatable starting state. Missing keys resolve to "rest". */
  from?: MotionStyleValues;
  /** Animatable target state. Missing keys resolve to "rest". */
  to?: MotionStyleValues;
  /** Tween duration (ms) or spring tuning. */
  duration?: number;
  delay?: number;
  ease?: Easing;
  mode?: 'tween' | 'spring';
  spring?: Partial<SpringParams>;
  loop?: LoopMode;
  counts?: number;
  /**
   * Two-state control: `true` animates to `to`, `false` animates back to
   * `from` (exit). When omitted the component plays its entry once.
   */
  show?: boolean;
  /** Alternate two-state control that replays when it flips to `true`. */
  playing?: boolean;
  /** Skip the automatic mount animation. */
  noAuto?: boolean;
  onAnimationEnd?: () => void;
  ref?: Ref<HTMLElement | null>;
  style?: CSSProperties;
  children?: ReactNode;
}

interface Engine {
  active: boolean;
  progress: number;
  elapsed: number;
  delayLeft: number;
  iterations: number;
  plane: { from: MotionStyleValues; to: MotionStyleValues };
}

const SPRING_DEFAULTS: SpringParams = { stiffness: 210, damping: 20, mass: 1 };

/**
 * Animate an element between `from` and `to` style states. Writes transforms
 * directly to the DOM (zero re-renders), respects the motion policy, and
 * handles tween/spring modes plus loop/mirror choreography.
 */
export function Animate(props: AnimateProps): ReactNode {
  const { as = 'div', preset, from, to, duration, delay, ease, mode = 'tween', spring, loop, counts, show, playing, noAuto, ref, style, children, onAnimationEnd, ...rest } = props;

  const prefsRef = useRef({ reduced: false, rate: 1, frozen: false });
  const prefs = useMotionPrefs();
  useEffect(() => {
    prefsRef.current = prefs;
  });

  const nodeRef = useRef<HTMLElement | null>(null);
  const endedRef = useRef(onAnimationEnd);
  useEffect(() => {
    endedRef.current = onAnimationEnd;
  });

  /* Resolve the effective preset + explicit overrides into an immutable spec. */
  const specRef = useRef<{
    keys: string[];
    fromV: MotionStyleValues;
    toV: MotionStyleValues;
    duration: number;
    delay: number;
    ease: EasingFn;
    mode: 'tween' | 'spring';
    spring: SpringParams;
    loop: LoopMode;
    counts: number;
  } | null>(null);

  const spec = useMemo(() => {
    const p: PresetSpec | undefined = preset ? resolvePreset(preset) : undefined;
    const keys = unionKeys(from ?? p?.from, to ?? p?.to);
    const merged: {
      fromV: MotionStyleValues;
      toV: MotionStyleValues;
      duration: number;
      delay: number;
      ease: Easing;
      mode: 'tween' | 'spring';
      spring: Partial<SpringParams>;
      loop: LoopMode;
      counts: number;
    } = {
      fromV: { ...(p?.from ?? {}), ...(from ?? {}) },
      toV: { ...(p?.to ?? {}), ...(to ?? {}) },
      duration: duration ?? p?.duration ?? 320,
      delay: delay ?? 0,
      ease: ease ?? p?.ease ?? 'out',
      mode: mode ?? p?.mode ?? 'tween',
      spring: spring ?? {},
      loop: loop ?? p?.loop ?? 'none',
      counts: counts ?? p?.counts ?? 0,
    };
    return {
      keys,
      fromV: merged.fromV,
      toV: merged.toV,
      duration: Math.max(1, merged.duration),
      delay: merged.delay,
      ease: resolveEasing(merged.ease),
      mode: merged.mode,
      spring: { ...SPRING_DEFAULTS, ...merged.spring },
      loop: merged.loop,
      counts: merged.counts,
    };
  }, [preset, from, to, duration, delay, ease, mode, spring, loop, counts]);

  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  const eng = useRef<Engine>({
    active: false,
    progress: 0,
    elapsed: 0,
    delayLeft: 0,
    iterations: 0,
    plane: { from: {}, to: {} },
  });

  /* Visible "a frame loop is armed" flag so the effect below re-subscribes
   * whenever playToward starts/stops an animation. */
  const [looping, setLooping] = useState(false);

  /** Synchronously write the snapshot at eased progress `t` for a plane. */
  const applySnap = useCallback(
    (plane: { from: MotionStyleValues; to: MotionStyleValues }, t: number) => {
      const el = nodeRef.current;
      if (!el) return;
      const out: MotionStyleValues = {};
      for (const k of specRef.current?.keys ?? []) (out as Record<string, number>)[k] = mixKey(k, plane.from, plane.to, t);
      const s = buildMotionStyle(out);
      if (s.transform !== undefined) el.style.transform = s.transform;
      if (s.opacity !== undefined) el.style.opacity = String(s.opacity);
      if (s.filter !== undefined) el.style.filter = s.filter;
    },
    [],
  );

  const finish = useCallback(() => {
    const e = eng.current;
    e.active = false;
    applySnap(e.plane, 1);
    setLooping(false);
    endedRef.current?.();
  }, [applySnap]);

  useEffect(() => {
    if (!looping) return;
    return subscribeFrame((_, rawDt) => {
      const e = eng.current;
      if (!e.active) return;
      const prefs2 = prefsRef.current;
      if (prefs2.frozen || prefs2.rate === 0) return;
      const S = specRef.current;
      if (!S) return;
      const dt = rawDt * prefs2.rate;

      if (e.delayLeft > 0) {
        e.delayLeft -= dt;
        return;
      }

      if (S.mode === 'spring') {
        const r = stepSpring(e.progress, 0, 1, S.spring, dt);
        e.progress = r.atRest ? 1 : r.value;
        applySnap(e.plane, clamp(e.progress, 0, 1));
        if (r.atRest) finish();
        return;
      }

      e.elapsed += dt;
      let done = false;
      if (e.elapsed >= S.duration) {
        e.iterations += 1;
        if (S.loop === 'loop') {
          if (S.counts !== 0 && e.iterations >= S.counts) done = true;
          else e.elapsed = e.elapsed % S.duration;
        } else if (S.loop === 'mirror') {
          if (S.counts !== 0 && e.iterations >= S.counts) {
            done = true;
          } else {
            const tmp = e.plane.from;
            e.plane.from = e.plane.to;
            e.plane.to = tmp;
            e.elapsed = 0;
          }
        } else {
          done = true;
        }
      }
      if (done) {
        finish();
        return;
      }
      const t = Math.min(1, e.elapsed / S.duration);
      applySnap(e.plane, S.ease(t));
    });
  }, [applySnap, finish, looping]);

  /* Play toward the target direction respecting policy + reduced motion. */
  const playToward = useCallback(
    (toTarget: boolean) => {
      const el = nodeRef.current;
      const S = specRef.current;
      if (!el || !S) return;
      const plane = { from: toTarget ? S.fromV : S.toV, to: toTarget ? S.toV : S.fromV };
      eng.current = { active: true, progress: 0, elapsed: 0, delayLeft: S.delay, iterations: 0, plane };
      const prefs = prefsRef.current;
      if (prefs.reduced || prefs.frozen) {
        applySnap(plane, 1);
        setLooping(false);
        endedRef.current?.();
        return;
      }
      applySnap(plane, 0);
      setLooping(true); // re-arm the frame loop
    },
    [applySnap],
  );

  /* Directional driver: show/playing, then a one-shot mount animation. */
  useEffect(() => {
    if (show !== undefined) {
      playToward(show === true);
      return;
    }
    if (playing !== undefined) {
      playToward(playing === true);
      return;
    }
    if (!noAuto) playToward(true);
  }, [show, playing, playToward, noAuto]);

  return createElement(
    as,
    {
      ref: (n: HTMLElement | null) => {
        nodeRef.current = n;
        if (typeof ref === 'function') ref(n);
        else if (ref) (ref as { current: HTMLElement | null }).current = n;
      },
      style,
      ...rest,
    },
    children,
  );
}

/* ------------------------- entry punctuations ---------------------------- */

export type EntryProps = Omit<AnimateProps, 'from' | 'to'>;

/** Fade in/out. Powered by `useReducedMotion` at the provider boundary. */
export function Fade(props: EntryProps & { fromOpacity?: number }): ReactNode {
  const { fromOpacity, ...rest } = props;
  if (rest.preset) return <Animate {...rest} />;
  return <Animate {...rest} from={{ opacity: fromOpacity ?? 0 }} />;
}

export type SlideDirection = 'up' | 'down' | 'left' | 'right';

export interface SlideProps extends EntryProps {
  direction?: SlideDirection;
  /** Travel distance in px (default `enter` token = 24). */
  distance?: number;
}

const SLIDE_OFF: Record<SlideDirection, (px: number) => MotionStyleValues> = {
  up: (px) => ({ y: px }),
  down: (px) => ({ y: -px }),
  left: (px) => ({ x: px }),
  right: (px) => ({ x: -px }),
};

/** Slide the element in from an edge (transform-only; pair with Fade if needed). */
export function Slide(props: SlideProps): ReactNode {
  const { direction = 'up', distance = 24, ...rest } = props;
  if (rest.preset) return <Animate {...rest} />;
  return <Animate {...rest} from={SLIDE_OFF[direction](distance)} />;
}

/** Pop/card-scale entrance with a spring head. */
export function Zoom(props: EntryProps & { fromScale?: number }): ReactNode {
  const { fromScale, mode = 'spring', ...rest } = props;
  if (rest.preset) return <Animate {...rest} />;
  return <Animate {...rest} mode={mode} from={{ scale: fromScale ?? 0.96, opacity: 0 }} />;
}

export interface FlipProps extends EntryProps {
  /** `y` flips around the vertical axis (page turn), `x` around horizontal. */
  axis?: 'x' | 'y';
}

/** 3D flip entrance. Pair with keepChild across the seam for card flips. */
export function Flip(props: FlipProps): ReactNode {
  const { axis = 'y', mode = 'spring', ...rest } = props;
  if (rest.preset) return <Animate {...rest} />;
  return <Animate {...rest} mode={mode} from={axis === 'y' ? { rotateY: 96, opacity: 0 } : { rotateX: 96, opacity: 0 }} />;
}

/** Sprightly rotation entrance (spring head, never oppressive). */
export function Rotate(props: EntryProps & { fromDeg?: number }): ReactNode {
  const { fromDeg, mode = 'spring', ...rest } = props;
  if (rest.preset) return <Animate {...rest} />;
  return <Animate {...rest} mode={mode} from={{ rotate: fromDeg ?? -180, opacity: 0 }} />;
}

/* -------------------------------- reveal --------------------------------- */

export interface RevealProps extends Omit<AnimateProps, 'from' | 'to' | 'show'> {
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/** Scroll-triggered entrance: hidden until the element crosses the join. */
export function Reveal(props: RevealProps): ReactNode {
  const { direction = 'up', distance = 24, threshold = 0.2, rootMargin = '0px', once = true, ref, ...rest } = props;
  const inView = useInView<HTMLElement>({ once, threshold, rootMargin });
  const from = revealFrom(direction === 'none' ? 'up' : direction, distance);
  const fromV = from && direction !== 'none' ? from : { opacity: 0 };
  return <Animate {...rest} ref={ref} show={inView.inView} from={fromV} />;
}

/* -------------------------------- parallax ------------------------------- */

export interface ParallaxProps {
  /** Additional DOM content painted below the moving plane. */
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  strength?: number;
  axis?: 'x' | 'y';
}

/** Move the wrapped content at a different rate to the page scroll. */
export function Parallax({ children, strength = 40, axis = 'y', style, className }: ParallaxProps): ReactNode {
  const { ref, offset } = useParallax({ strength, axis });
  void offset;
  return (
    <div ref={ref as Ref<HTMLDivElement>} className={className} style={style}>
      {children}
    </div>
  );
}

/* ------------------------------ spring host ------------------------------ */

export interface SpringProps {
  /** Target animatable transform/opacity/filter states. */
  to?: MotionStyleValues;
  /** Starting states (default: "rest" for each key). */
  from?: MotionStyleValues;
  children?: ReactNode;
  spring?: Partial<SpringParams>;
  style?: CSSProperties;
  className?: string;
}

/** Render an element that spring-animates its bound transform/opacity/filter. */
export function Spring({ to, from, children, spring, style, className }: SpringProps): ReactNode {
  const keys = unionKeys(from, to);
  const initial: MotionStyleValues = {};
  for (const k of keys) {
    const f = (from as Record<string, number> | undefined)?.[k];
    (initial as Record<string, number>)[k] = f ?? REST[k] ?? 0;
  }
  const obj = useSpringObject(initial, spring, to);
  return (
    <div ref={obj.style.ref as Ref<HTMLDivElement>} className={className} style={style}>
      {children}
    </div>
  );
}

/* ------------------------------ numeric host ----------------------------- */

export interface TweenProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  to: number;
  from?: number;
  duration?: number;
  delay?: number;
  ease?: Easing;
  format?: (v: number) => string;
  as?: ElementType;
  auto?: boolean;
  /** Render-prop form receives the live value on the React clock. */
  children?: ReactNode | ((v: number) => ReactNode);
}

/** Tween a number, rendering through React (or a render-prop). */
export function Tween({ to, from, duration, delay, ease, format, as = 'span', auto = true, children, ...rest }: TweenProps): ReactNode {
  const controller = useTween({ from: from ?? 0, to, duration: duration ?? 320, delay, ease });
  const value = useMotionValueRender(controller.value);
  useEffect(() => {
    if (auto) controller.play();
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  const body = typeof children === 'function' ? children(value) : (format ? format(value) : value);
  return createElement(as, rest, body);
}

export interface TimelineProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  points: TimelineSpec['points'];
  duration?: number;
  loop?: boolean;
  as?: ElementType;
  auto?: boolean;
  format?: (v: number) => string;
  children?: ReactNode | ((v: number) => ReactNode);
}

/** Play a keyframe timeline, rendering the live value through React. */
export function Timeline({ points, duration = 1000, loop = false, as = 'span', auto = true, format, children, ...rest }: TimelineProps): ReactNode {
  const controller = useTimeline({ points, duration, loop });
  const value = useMotionValueRender(controller.value);
  useEffect(() => {
    if (auto) controller.play();
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  const body = typeof children === 'function' ? children(value) : (format ? format(value) : value);
  return createElement(as, rest, body);
}

/* ------------------------------ stagger ---------------------------------- */

export interface StaggerProps {
  children?: ReactNode;
  /** Explicit item count (derived from children when omitted). */
  count?: number;
  interval?: number;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  /** Per-item entrance duration (ms). */
  duration?: number;
  once?: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/** Fan a group of children in one-by-one. Children are wrapped as reveals. */
export function Stagger({ children, count, interval = 60, delay = 0, direction = 'up', distance = 24, duration, once = true, as = 'div', className, style }: StaggerProps): ReactNode {
  const items = children ? (Array.isArray(children) ? children : [children]) : [];
  const n = count ?? items.length;
  const { delays } = useStagger({ count: n, interval, delay });
  return createElement(
    as,
    { className, style },
    items.map((child, i) => (
      <Reveal key={i} direction={direction} distance={distance} duration={duration} once={once} delay={delays[i] ?? 0}>
        {child}
      </Reveal>
    )),
  );
}

/* -------------------------------- cascade -------------------------------- */

export interface CascadeProps {
  children?: ReactNode;
  count?: number;
  interval?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  /** Per-item animation duration (ms). */
  duration?: number;
  threshold?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/** Reveal a group together once visible, then stagger each child's turn. */
export function Cascade({ children, count, interval = 60, direction = 'up', distance = 24, duration, threshold = 0.2, as = 'div', className, style }: CascadeProps): ReactNode {
  const items = children ? (Array.isArray(children) ? children : [children]) : [];
  const n = count ?? items.length;
  const group = useCascade<HTMLElement>(n, { interval, threshold });
  const from = revealFrom(direction, distance) ?? { opacity: 0 };
  return createElement(
    as,
    { ref: group.ref as Ref<HTMLDivElement>, className, style },
    items.map((child, i) => (
      <Animate key={i} show={group.visible} delay={(group.delays[i] ?? 0)} duration={duration} from={from}>
        {child}
      </Animate>
    )),
  );
}

/* -------------------------------- count up ------------------------------- */

export interface CountUpProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  to: number;
  from?: number;
  duration?: number;
  delay?: number;
  ease?: Easing;
  format?: (v: number) => string;
  as?: ElementType;
}

/** Large numeral tween — the classic "0 → value" stat animation. */
export function CountUp({ to, from = 0, duration = 1000, delay = 0, ease = 'out', format, as = 'span', ...rest }: CountUpProps): ReactNode {
  const count = useCount(to, { from, duration, delay, ease, format });
  useEffect(() => {
    count.play();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return createElement(as, rest, count.formatted);
}

/* -------------------------------- skeleton ------------------------------- */

export interface SkeletonProps {
  lines?: number;
  width?: string | number;
  height?: string | number;
  rounded?: boolean | string;
  variant?: 'shimmer' | 'pulse';
  className?: string;
  style?: CSSProperties;
  /** Accessible label for screen readers (default "Loading…"). */
  label?: string;
}

const baseLine: CSSProperties = { display: 'block', background: '#eef1f5', overflow: 'hidden', position: 'relative' };

/** Placeholder that communicates "content is coming" without motion noise. */
export function Skeleton({ lines = 1, width = '100%', height = 12, rounded = true, variant = 'shimmer', className, style, label = 'Loading…' }: SkeletonProps): ReactNode {
  const radius = rounded === true ? 6 : rounded === false ? 0 : rounded;
  const rows = Array.from({ length: lines }, (_, i) => <SkeletonRow key={i} variant={variant} width={width} height={height} radius={radius} />);
  return (
    <div role="status" aria-label={label} className={className} style={style}>
      {rows}
      <span className="sr-only">{label}</span>
    </div>
  );
}

function SkeletonRow({ variant, width, height, radius }: { variant: 'shimmer' | 'pulse'; width: string | number; height: string | number; radius: string | number }) {
  if (variant === 'pulse') {
    return (
      <Animate
        mode="tween"
        loop="mirror"
        noAuto={false}
        style={{ ...baseLine, width, height, borderRadius: radius, marginBottom: 8, background: '#eef1f5' }}
        from={{ opacity: 1 }}
        to={{ opacity: 0.45 }}
      />
    );
  }
  return <ShimmerLine width={width} height={height} radius={radius} />;
}

/** Sweep a light highlight across the placeholder on an interval. */
function ShimmerLine({ width, height, radius }: { width: string | number; height: string | number; radius: string | number }) {
  const host = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(-140);
  const { ref: binder } = useMotionStyle({ x });
  const visible = useInView<HTMLDivElement>({ once: true, threshold: 0.05 });
  useEffect(() => {
    if (!visible.inView) return;
    const el = host.current;
    const factor = el ? Math.max(40, el.offsetWidth * 0.5) : 120;
    let sweep = x.get();
    return subscribeFrame((_, dt) => {
      sweep = (sweep + dt * 0.18 * factor) % (factor * 3) - factor;
      x.set(sweep);
    });
  }, [visible.inView, x]);
  const binderMutable = binder as { current: HTMLElement | null };
  const setBoth = (n: HTMLDivElement | null) => {
    host.current = n;
    binderMutable.current = n;
  };
  return (
    <div ref={setBoth} style={{ ...baseLine, width, height, borderRadius: radius, marginBottom: 8 }}>
      <div
        ref={(n) => {
          binderMutable.current = n;
        }}
        style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)' }}
      />
    </div>
  );
}

/* --------------------------------- ripple -------------------------------- */

export interface RippleProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Ripple diameter base. */
  size?: number;
  /** Ripple animation duration (ms). */
  duration?: number;
  color?: string;
}

interface RingData {
  id: number;
  x: number;
  y: number;
}

let ringUid = 0;

/** Material ripple on tap. Inert under reduced motion (shows a static flash). */
export function Ripple({ children, className, style, size = 48, duration = 500, color = 'rgba(120, 120, 140, 0.28)' }: RippleProps): ReactNode {
  const getRef = useRef<HTMLElement | null>(null);
  const [rings, setRings] = useState<RingData[]>([]);
  const onDown = (e: React.PointerEvent) => {
    const el = getRef.current;
    if (!el || (e.currentTarget as HTMLElement).matches(':disabled')) return;
    const rect = el.getBoundingClientRect();
    setRings((prev) => [...prev, { id: ++ringUid, x: (e.clientX ?? 0) - rect.left, y: (e.clientY ?? 0) - rect.top }]);
  };
  const remove = useCallback((id: number) => setRings((prev) => prev.filter((r) => r.id !== id)), []);
  return (
    <span
      ref={(n) => (getRef.current = n)}
      className={className}
      style={{ position: 'relative', display: 'inline-block', overflow: 'hidden', ...style }}
      onPointerDown={onDown}
    >
      {children}
      {rings.map((r) => (
        <RippleRing key={r.id} data={r} size={size} duration={duration} color={color} onDone={remove} />
      ))}
    </span>
  );
}

function RippleRing({ data, size, duration, color, onDone }: { data: RingData; size: number; duration: number; color: string; onDone: (id: number) => void }) {
  return (
    <span data-ripple={data.id}>
      <Animate
        mode="tween"
        duration={duration}
        ease="out"
        onAnimationEnd={() => onDone(data.id)}
        from={{ scale: 0.45, opacity: 0.8 }}
        to={{ scale: 1, opacity: 0 }}
        style={{ position: 'absolute', left: data.x - size / 2, top: data.y - size / 2, width: size, height: size, borderRadius: '50%', background: color, pointerEvents: 'none' }}
      />
    </span>
  );
}

/* ------------------------------- pressable ------------------------------- */

export interface PressableProps extends Omit<AnimateProps, 'from' | 'to' | 'mode' | 'onAnimationEnd' | 'show' | 'playing'> {
  onPress?: () => void;
  disabled?: boolean;
  /** Press-pressed scale (default 0.97). */
  scale?: number;
  /** Animation mode for the press feedback (default spring). */
  mode?: AnimateProps['mode'];
}

/** Accessible pressable that gives haptic-style scale feedback on tap. */
export function Pressable({ children, onPress, disabled = false, scale = 0.97, mode = 'spring', className, style, as = 'button', ...rest }: PressableProps): ReactNode {
  const tap = useTap({ onTap: onPress, disabled });
  return (
    <Animate
      {...rest}
      as={as}
      className={className}
      style={style}
      mode={mode}
      from={{ scale: 1 }}
      to={{ scale }}
      show={!disabled && tap.pressed}
      {...tap.bind}
    >
      {children}
    </Animate>
  );
}

/* --------------------------------- shake --------------------------------- */

export interface ShakeProps {
  trigger?: number;
  children?: ReactNode;
  duration?: number;
  distance?: number;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}

/** Tilt-shift: shake horizontally when `trigger` increments. Ends centred. */
export function Shake({ trigger = 0, children, duration = 400, distance = 10, className, style, as = 'div' }: ShakeProps): ReactNode {
  const ref = useRef<HTMLElement | null>(null);
  const x = useMotionValue(0);
  const { ref: binder } = useMotionStyle({ x });
  const spec = useMemo<TimelineSpec>(
    () => ({
      points: [
        { at: 0, value: 0, ease: 'out' },
        { at: 0.3, value: -distance, ease: 'inOut' },
        { at: 0.5, value: 0, ease: 'inOut' },
        { at: 0.75, value: distance, ease: 'inOut' },
        { at: 1, value: 0, ease: 'out' },
      ],
      duration,
      loop: false,
    }),
    [distance, duration],
  );
  const timeline = useTimeline(spec);
  useEffect(() => {
    return timeline.value.subscribe((v) => x.set(v));
  }, [timeline.value, x]);
  useEffect(() => {
    if (trigger !== 0) timeline.play();
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  const setBoth = (n: HTMLElement | null) => {
    ref.current = n;
    (binder as { current: HTMLElement | null }).current = n;
  };
  return createElement(as, { ref: setBoth, className, style, 'data-shake': String(trigger) }, children);
}

/* ----------------------------- scroll helpers ---------------------------- */

export interface ScrollToTopProps {
  threshold?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
  /** Override anchor offset into the page (default top). */
  behavior?: ScrollBehavior;
  /** Entry/exit animation duration (ms). */
  duration?: number;
}

/** Floating "back to top" affordance: appears once you scroll past a floor. */
export function ScrollToTop({ threshold = 320, label = 'Back to top', className, style, behavior = 'smooth', duration }: ScrollToTopProps): ReactNode {
  const past = useScrolledPast(threshold);
  const onPress = () => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior });
  };
  return (
    <Animate as="span" show={past} from={{ opacity: 0, y: 12 }} noAuto duration={duration} style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, ...style }}>
      <button type="button" onClick={onPress} aria-label={label} className={className}>
        {label}
      </button>
    </Animate>
  );
}

export interface ScrollProgressBarProps {
  color?: string;
  track?: string;
  height?: number;
  zIndex?: number;
  className?: string;
}

/** Hemisphere progress bar pinned to the top; announces via aria-valuenow. */
export function ScrollProgressBar({ color = 'var(--accent, #4f6df5)', track = 'transparent', height = 3, zIndex = 1000, className }: ScrollProgressBarProps): ReactNode {
  const { scrollYProgress } = useScroll();
  const p = useMotionValueRender(scrollYProgress);
  const pct = Math.round(p * 100);
  return (
    <div role="progressbar" aria-label="Scroll progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={className} style={{ position: 'fixed', top: 0, left: 0, right: 0, height, background: track, zIndex }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 120ms linear' }} />
    </div>
  );
}

export interface StickyProps {
  top?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** CSS-position sticky with a `data-stuck` reflection when clamped. */
export function Sticky({ top = 0, children, className, style }: StickyProps): ReactNode {
  const { ref, stuck } = useSticky({ top });
  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      {...(stuck ? { 'data-stuck': 'true' } : {})}
      className={className}
      style={{ position: 'sticky', top, ...style }}
    >
      {children}
    </div>
  );
}

/* ------------------------------ convenience ------------------------------ */

export { MotionProvider };