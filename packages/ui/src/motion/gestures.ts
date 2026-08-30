import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { MotionValue } from './core';
import { stepFriction } from './physics';
import { subscribeFrame } from './raf';

/**
 * WCO Motion — gestures.
 *
 * Dependency-free pointer/pointer-capture handlers. Every hook returns a
 * `bind` object you spread onto an element, plus MotionValues that animate in
 * place. All state lives in refs (no re-renders during interaction); only
 * semantic toggles (hovered/focused/dragging) surface as React state.
 * Keyboard & focus equivalents are provided so nothing is touch/mouse-only.
 */

export type GestureAxis = 'x' | 'y' | 'both';

export interface BindHandlers {
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove?: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel?: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerEnter?: (e: ReactPointerEvent<HTMLElement>) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onFocus?: (e: ReactFocusEvent<HTMLElement>) => void;
  onBlur?: (e: ReactFocusEvent<HTMLElement>) => void;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLElement>) => void;
}

export interface GestureBind extends BindHandlers {
  style?: CSSProperties;
  role?: string;
  tabIndex?: number;
  'aria-pressed'?: boolean;
  'aria-grabbed'?: boolean;
  'aria-expanded'?: boolean;
  'aria-label'?: string;
}

const NO_TOUCH: CSSProperties = { touchAction: 'none' };

function pointOf(e: Pick<ReactPointerEvent<HTMLElement>, 'clientX' | 'clientY' | 'pointerId' | 'pointerType'>): { x: number; y: number } {
  return { x: e.clientX, y: e.clientY };
}

interface Sample {
  t: number;
  x: number;
  y: number;
}

/** Recent-motion velocity (px/ms) computed from the last ~80ms of samples. */
function velocityOf(samples: Sample[]): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const a = samples[0];
  const b = samples[samples.length - 1];
  const dt = Math.max(1, b.t - a.t);
  return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
}

function setPointerCapture(e: ReactPointerEvent<HTMLElement>): void {
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}

/* --------------------------------- tap ---------------------------------- */

export interface TapHandlers {
  onTap?: (p: { x: number; y: number }) => void;
  onTapStart?: (p: { x: number; y: number }) => void;
  onTapEnd?: (p: { x: number; y: number }) => void;
  onDoubleTap?: (p: { x: number; y: number }) => void;
  onLongPress?: (p: { x: number; y: number }) => void;
  maxTapMovement?: number;
  maxTapDuration?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  disabled?: boolean;
  onPress?: (p: { x: number; y: number }) => void;
}

export interface TapResult {
  bind: GestureBind;
  bool: { pressed: boolean };
  pressed: boolean;
}

/** Tap / double-tap / long-press recognizer with keyboard support. */
export function useTap(handlers: TapHandlers): TapResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const [pressed, setPressed] = useState(false);
  const s = useRef({
    down: false,
    start: { x: 0, y: 0, t: 0 },
    moveDist: 0,
    longTimers: 0,
    longRan: false,
    lastTapT: -9999,
  });

  const start = (e: ReactPointerEvent<HTMLElement>) => {
    if (h.current.disabled) return;
    const p = pointOf(e);
    setPointerCapture(e);
    s.current.down = true;
    s.current.start = { x: p.x, y: p.y, t: performance.now() };
    s.current.moveDist = 0;
    s.current.longRan = false;
    h.current.onTapStart?.(p);
    setPressed(true);
    if (h.current.longPressDelay) {
      s.current.longTimers = setTimeout(() => {
        if (s.current.down && !s.current.longRan) {
          s.current.longRan = true;
          h.current.onLongPress?.(s.current.start);
        }
      }, h.current.longPressDelay) as unknown as number;
    }
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (!s.current.down) return;
    const p = pointOf(e);
    s.current.moveDist = Math.max(s.current.moveDist, Math.abs(p.x - s.current.start.x), Math.abs(p.y - s.current.start.y));
    if (s.current.moveDist > (h.current.maxTapMovement ?? 8)) s.current.down = false;
  };

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    if (typeof s.current.longTimers === 'number') clearTimeout(s.current.longTimers);
    const p = pointOf(e);
    const wasDown = s.current.down;
    s.current.down = false;
    setPressed(false);
    h.current.onTapEnd?.(p);
    if (!wasDown) return;
    const dt = performance.now() - s.current.start.t;
    if (dt > (h.current.maxTapDuration ?? 600)) return;
    const now = performance.now();
    const isDouble = now - s.current.lastTapT < (h.current.doubleTapDelay ?? 300);
    s.current.lastTapT = now;
    if (isDouble) {
      h.current.onDoubleTap?.(p);
    } else {
      h.current.onTap?.(p);
      h.current.onPress?.(p);
    }
  };

  const key = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (h.current.disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const last = s.current.lastTapT;
      const now = performance.now();
      const isDouble = now - last < (h.current.doubleTapDelay ?? 300);
      s.current.lastTapT = now;
      const p = { x: 0, y: 0 };
      if (isDouble) h.current.onDoubleTap?.(p);
      else {
        h.current.onTap?.(p);
        h.current.onPress?.(p);
      }
    }
  };

  return {
    pressed,
    bool: { pressed },
    bind: {
      role: 'button',
      tabIndex: h.current.disabled ? -1 : 0,
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
      onKeyDown: key,
      'aria-pressed': pressed,
    },
  };
}

/* -------------------------------- hover --------------------------------- */

export interface HoverResult {
  bind: GestureBind;
  hovered: boolean;
}

/** Hover & hover-unhover with optional delay. Pointer + mouse dual compat. */
export function useHover(handlers: { onEnter?: () => void; onLeave?: () => void; disabled?: boolean } = {}): HoverResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const [hovered, setHovered] = useState(false);

  const enter = () => {
    if (h.current.disabled) return;
    setHovered(true);
    h.current.onEnter?.();
  };
  const leave = () => {
    if (h.current.disabled) return;
    setHovered(false);
    h.current.onLeave?.();
  };

  return { hovered, bind: { onPointerEnter: enter, onPointerLeave: leave, onMouseEnter: enter, onMouseLeave: leave } };
}

/* -------------------------------- focus --------------------------------- */

export interface FocusResult {
  bind: GestureBind;
  focused: boolean;
  focusVisible: boolean;
  focus: () => void;
}

/**
 * Focus with focus-visible semantics. `focusVisible` is true only when the
 * element was focused via keyboard (supports :focus-visible when available,
 * falls back to a keyboard-tracking heuristic).
 */
export function useFocus(handlers: { onFocus?: () => void; onBlur?: () => void; disabled?: boolean } = {}): FocusResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const [focused, setFocused] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const keyboardRef = useRef(false);

  useEffect(() => {
    const onDown = () => {
      keyboardRef.current = false;
      setFocusVisible(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) return;
      keyboardRef.current = true;
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const focus = useCallback(() => {
    if (h.current.disabled) return;
    keyboardRef.current = true;
  }, []);

  const onFocus = () => {
    if (h.current.disabled) return;
    setFocused(true);
    setFocusVisible(keyboardRef.current);
    h.current.onFocus?.();
  };
  const onBlur = () => {
    setFocused(false);
    setFocusVisible(false);
    h.current.onBlur?.();
  };

  return { focused, focusVisible, focus, bind: { onFocus, onBlur, tabIndex: h.current.disabled ? -1 : 0 } };
}

/* -------------------------------- swipe --------------------------------- */

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export type SwipeResult = {
  bind: GestureBind;
  swiped: SwipeDirection | null;
};

/** Directional swipe recognizer (works for touch + pen + mouse drags). */
export function useSwipe(handlers: {
  onSwipe?: (d: { direction: SwipeDirection; deltaX: number; deltaY: number; velocity: number }) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  threshold?: number;
  axis?: GestureAxis;
  disabled?: boolean;
}): SwipeResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const [swiped, setSwiped] = useState<SwipeDirection | null>(null);
  const s = useRef({ down: false, x: 0, y: 0, samples: [] as Sample[] });

  const run = (dir: SwipeDirection | null) => {
    setSwiped(dir);
    if (dir) {
      h.current.onSwipe?.({
        direction: dir,
        deltaX: s.current.x,
        deltaY: s.current.y,
        velocity: Math.hypot(velocityOf(s.current.samples).vx, velocityOf(s.current.samples).vy),
      });
    }
    h.current.onSwipeEnd?.();
    s.current = { down: false, x: 0, y: 0, samples: [] };
  };

  const down = (e: ReactPointerEvent<HTMLElement>) => {
    if (h.current.disabled) return;
    const p = pointOf(e);
    setPointerCapture(e);
    s.current = { down: true, x: 0, y: 0, samples: [{ t: performance.now(), x: p.x, y: p.y }] };
    h.current.onSwipeStart?.();
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (!s.current.down) return;
    const p = pointOf(e);
    const base = s.current.samples[0];
    s.current.x = p.x - base.x;
    s.current.y = p.y - base.y;
    s.current.samples.push({ t: performance.now(), x: p.x, y: p.y });
    if (s.current.samples.length > 12) s.current.samples.shift();
  };

  const up = () => {
    if (!s.current.down) return;
    const { x, y } = s.current;
    const threshold = h.current.threshold ?? 24;
    const axis = h.current.axis ?? 'both';
    const distX = Math.abs(x);
    const distY = Math.abs(y);
    let dir: SwipeDirection | null = null;
    if (distX >= threshold || distY >= threshold) {
      if (axis === 'x' || (axis === 'both' && distX >= distY)) dir = x > 0 ? 'right' : 'left';
      else dir = y > 0 ? 'down' : 'up';
    }
    run(dir);
  };

  return { swiped, bind: { style: NO_TOUCH, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } };
}

/* -------------------------------- pinch --------------------------------- */

export interface PinchResult {
  bind: GestureBind;
  scale: MotionValue<number>;
  rotation: MotionValue<number>;
  pinching: boolean;
}

/** Two-pointer pinch: distance → scale, angle → rotation. Real 2-finger math. */
export function usePinch(handlers: {
  onPinch?: (o: { scale: number; rotation: number }) => void;
  onPinchStart?: () => void;
  onPinchEnd?: () => void;
  disabled?: boolean;
}): PinchResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const scale = useRef(new MotionValue(1));
  const rotation = useRef(new MotionValue(0));
  const [pinching, setPinching] = useState(false);
  const s = useRef({ ptrs: new Map<number, { x: number; y: number }>(), startDist: 0, startAngle: 0 });

  const down = (e: ReactPointerEvent<HTMLElement>) => {
    if (h.current.disabled) return;
    setPointerCapture(e);
    s.current.ptrs.set(e.pointerId, pointOf(e));
    if (s.current.ptrs.size === 2) {
      h.current.onPinchStart?.();
      const pts = Array.from(s.current.ptrs.values());
      s.current.startDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      s.current.startAngle = (Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI;
      setPinching(true);
    }
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const m = s.current.ptrs;
    if (!m.has(e.pointerId)) return;
    m.set(e.pointerId, pointOf(e));
    if (m.size === 2) {
      const pts = Array.from(m.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      const angle = (Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180) / Math.PI;
      const sc = dist / s.current.startDist;
      const rot = angle - s.current.startAngle;
      scale.current.set(sc);
      rotation.current.set(rot);
      h.current.onPinch?.({ scale: sc, rotation: rot });
    }
  };

  const up = (e: ReactPointerEvent<HTMLElement>) => {
    s.current.ptrs.delete(e.pointerId);
    if (s.current.ptrs.size < 2 && pinching) {
      setPinching(false);
      h.current.onPinchEnd?.();
    }
  };

  return { scale: scale.current, rotation: rotation.current, pinching, bind: { style: NO_TOUCH, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onPointerLeave: up } };
}

/* -------------------------------- drag --------------------------------- */

export interface DragHandlers {
  axis?: GestureAxis;
  min?: number;
  max?: number;
  bounds?: { top?: number; left?: number; right?: number; bottom?: number };
  momentum?: boolean;
  momentumPower?: number;
  snapBack?: boolean;
  onDrag?: (o: { x: number; y: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: (o: { x: number; y: number }) => void;
  disabled?: boolean;
}

export interface DragResult {
  bind: GestureBind;
  x: MotionValue<number>;
  y: MotionValue<number>;
  dragging: boolean;
}

/** Pointer drag → x/y (spring-smoothed, momentum fling, optional bounds). */
export function useDrag(handlers: DragHandlers = {}): DragResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const x = useRef(new MotionValue(0));
  const y = useRef(new MotionValue(0));
  const [dragging, setDragging] = useState(false);
  const s = useRef({
    down: false,
    start: { x: 0, y: 0 },
    pointer: { x: 0, y: 0 },
    samples: [] as Sample[],
    frame: null as null | (() => void),
  });

  const clampPos = useCallback((px: number, py: number) => {
    const cfg = h.current;
    const axis = cfg.axis ?? 'both';
    let cx = px;
    let cy = py;
    if (axis === 'y') cx = 0;
    if (axis === 'x') cy = 0;
    if (cfg.min !== undefined) {
      if (axis === 'both' || axis === 'x') cx = Math.max(cfg.min, cx);
      if (axis === 'both' || axis === 'y') cy = Math.max(cfg.min, cy);
    }
    if (cfg.max !== undefined) {
      if (axis === 'both' || axis === 'x') cx = Math.min(cfg.max, cx);
      if (axis === 'both' || axis === 'y') cy = Math.min(cfg.max, cy);
    }
    return { x: cx, y: cy };
  }, []);

  const settle = useCallback(() => {
    const cfg = h.current;
    const cur = { x: x.current.get(), y: y.current.get() };
    const clamped = clampPos(cur.x, cur.y);
    if (clamped.x === cur.x && clamped.y === cur.y) {
      s.current.frame = null;
      return;
    }
    x.current.set(clamped.x);
    y.current.set(clamped.y);
    s.current.frame = null;
  }, [clampPos]);

  const fling = useCallback((vx: number, vy: number) => {
    const cfg = h.current;
    const power = cfg.momentumPower ?? 0.001;
    let px = x.current.get();
    let py = y.current.get();
    const off = subscribeFrame((_, dt) => {
      const fx = stepFriction(px, vx, { power }, dt);
      const fy = stepFriction(py, vy, { power }, dt);
      const clamped = clampPos(fx.value, fy.value);
      x.current.set(clamped.x);
      y.current.set(clamped.y);
      px = clamped.x;
      py = clamped.y;
      vx = fx.velocity;
      vy = fy.velocity;
      if (fx.atRest && fy.atRest) {
        s.current.frame = null;
        off();
        settle();
      }
    });
    s.current.frame = () => off();
  }, [clampPos, settle]);

  const down = (e: ReactPointerEvent<HTMLElement>) => {
    if (h.current.disabled) return;
    const p = pointOf(e);
    setPointerCapture(e);
    if (s.current.frame) {
      s.current.frame();
      s.current.frame = null;
    }
    s.current = { down: true, start: { x: p.x, y: p.y }, pointer: { x: p.x, y: p.y }, samples: [{ t: performance.now(), x: p.x, y: p.y }], frame: s.current.frame };
    setDragging(true);
    h.current.onDragStart?.();
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (!s.current.down) return;
    const p = pointOf(e);
    const dx = p.x - s.current.pointer.x;
    const dy = p.y - s.current.pointer.y;
    s.current.pointer = { x: p.x, y: p.y };
    s.current.samples.push({ t: performance.now(), x: p.x, y: p.y });
    if (s.current.samples.length > 12) s.current.samples.shift();
    const cfg = h.current;
    const axis = cfg.axis ?? 'both';
    let nx = x.current.get();
    let ny = y.current.get();
    if (axis === 'both' || axis === 'x') nx += dx;
    if (axis === 'both' || axis === 'y') ny += dy;
    const clamped = clampPos(nx, ny);
    x.current.set(clamped.x);
    y.current.set(clamped.y);
    h.current.onDrag?.({ x: clamped.x, y: clamped.y });
  };

  const up = () => {
    if (!s.current.down) return;
    s.current.down = false;
    setDragging(false);
    const cfg = h.current;
    h.current.onDragEnd?.({ x: x.current.get(), y: y.current.get() });
    if (cfg.momentum !== false) {
      const { vx, vy } = velocityOf(s.current.samples);
      if (Math.hypot(vx, vy) > 0.05 && cfg.axis !== undefined) fling(vx, vy);
      else if (Math.hypot(vx, vy) > 0.05) fling(vx, vy);
      else settle();
    } else {
      settle();
    }
  };

  return {
    dragging,
    x: x.current,
    y: y.current,
    bind: { style: NO_TOUCH, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up },
  };
}

/* ------------------------- move / rotate / scale ------------------------ */

export interface MoveResult {
  bind: GestureBind;
  x: MotionValue<number>;
  y: MotionValue<number>;
  active: boolean;
}

/** Relative pointer position inside the element (for tilt/follow effects). */
export function useMove(handlers: { onMove?: (p: { x: number; y: number }) => void; disabled?: boolean } = {}): MoveResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const x = useRef(new MotionValue(0));
  const y = useRef(new MotionValue(0));
  const [active, setActive] = useState(false);

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (h.current.disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect?.();
    const nx = rect && rect.width ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
    const ny = rect && rect.height ? ((e.clientY - rect.top) / rect.height) * 2 - 1 : 0;
    x.current.set(nx);
    y.current.set(ny);
    h.current.onMove?.({ x: nx, y: ny });
  };

  return {
    active,
    x: x.current,
    y: y.current,
    bind: { onPointerMove: move, onPointerEnter: () => setActive(true), onPointerLeave: () => setActive(false) },
  };
}

export interface RotateResult {
  bind: GestureBind;
  rotation: MotionValue<number>;
  rotating: boolean;
}

/** Dial-style rotation: angle from element centre while pressed. */
export function useRotate(handlers: { onRotate?: (deg: number) => void; disabled?: boolean } = {}): RotateResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const rotation = useRef(new MotionValue(0));
  const [rotating, setRotating] = useState(false);
  const s = useRef({ down: false, center: { x: 0, y: 0 } });

  const down = (e: ReactPointerEvent<HTMLElement>) => {
    if (h.current.disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect?.();
    s.current.down = true;
    s.current.center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
    setRotating(true);
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (!s.current.down) return;
    const deg = (Math.atan2(e.clientY - s.current.center.y, e.clientX - s.current.center.x) * 180) / Math.PI;
    rotation.current.set(deg);
    h.current.onRotate?.(deg);
  };

  const up = () => {
    if (!s.current.down) return;
    s.current.down = false;
    setRotating(false);
  };

  return { rotation: rotation.current, rotating, bind: { style: NO_TOUCH, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } };
}

export interface ScaleResult {
  bind: GestureBind;
  scale: MotionValue<number>;
  scaling: boolean;
}

/** Press-and-drag (vertical) zoom: distance from press origin maps to scale. */
export function useScale(handlers: { sensitivity?: number; min?: number; max?: number; onScale?: (s: number) => void; disabled?: boolean } = {}): ScaleResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const scale = useRef(new MotionValue(1));
  const [scaling, setScaling] = useState(false);
  const s = useRef({ down: false, origin: 0 });

  const down = (e: ReactPointerEvent<HTMLElement>) => {
    if (h.current.disabled) return;
    s.current.down = true;
    s.current.origin = e.clientY;
    setScaling(true);
  };

  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (!s.current.down) return;
    const sens = h.current.sensitivity ?? 0.01;
    const next = 1 + (e.clientY - s.current.origin) * sens;
    const clamped = Math.max(h.current.min ?? 0.5, Math.min(h.current.max ?? 2.5, next));
    scale.current.set(clamped);
    h.current.onScale?.(clamped);
  };

  const up = () => {
    if (!s.current.down) return;
    s.current.down = false;
    setScaling(false);
  };

  return { scale: scale.current, scaling, bind: { style: NO_TOUCH, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up } };
}

/* -------------------------------- resize -------------------------------- */

export interface ResizeResult {
  ref: React.RefObject<HTMLElement | null>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  measure: () => void;
}

/** Observe element size (ResizeObserver when present, else window resize). */
export function useResize(handlers: { onResize?: (r: { width: number; height: number }) => void } = {}): ResizeResult {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const ref = useRef<HTMLElement | null>(null);
  const width = useRef(new MotionValue(0));
  const height = useRef(new MotionValue(0));

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect?.();
    const w = r ? r.width : el.offsetWidth ?? 0;
    const ht = r ? r.height : el.offsetHeight ?? 0;
    width.current.set(w);
    height.current.set(ht);
    h.current.onResize?.({ width: w, height: ht });
  }, []);

  useEffect(() => {
    measure();
    if (typeof ResizeObserver !== 'undefined' && ref.current) {
      const ro = new ResizeObserver(measure);
      ro.observe(ref.current);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return { ref, width: width.current, height: height.current, measure };
}