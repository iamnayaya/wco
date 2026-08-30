import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { clamp, MotionValue, type MotionStyleValues } from './core';
import { subscribeFrame } from './raf';
import { useInView, useMotionValue } from './values';

/**
 * WCO Motion — scroll choreography.
 *
 * A single persistent frame subscription per `useScroll` host keeps every
 * scroll-derived value (progress, velocity, direction) sample-accurate and
 * throttled to rAF. Parallax/reveal/sticky/spy/infinite hooks build on it and
 * degrade gracefully in environments without IntersectionObserver.
 */

export interface ScrollInfo {
  scrollY: MotionValue<number>;
  scrollYProgress: MotionValue<number>;
  velocity: MotionValue<number>;
  direction: MotionValue<'up' | 'down' | null>;
}

export interface ScrollOptions {
  /** Scroll a nested container instead of the window. */
  containerRef?: RefObject<HTMLElement | null>;
}

function readScroll(el: HTMLElement | null | undefined): { top: number; scrollable: number } {
  if (el) {
    const scrollable = Math.max(0, el.scrollHeight - el.clientHeight);
    return { top: clamp(el.scrollTop ?? 0, 0, scrollable), scrollable };
  }
  if (typeof window === 'undefined') return { top: 0, scrollable: 0 };
  const doc = document.documentElement;
  const scrollable = Math.max(0, (doc?.scrollHeight ?? 0) - window.innerHeight);
  const top = clamp(typeof window.scrollY === 'number' ? window.scrollY : typeof window.pageYOffset === 'number' ? window.pageYOffset : 0, 0, scrollable);
  return { top, scrollable };
}

/** Live scroll metrics: position, normalized [0,1] progress and velocity. */
export function useScroll(options: ScrollOptions = {}): ScrollInfo {
  const { containerRef } = options;
  const scrollY = useMotionValue(0);
  const progress = useMotionValue(0);
  const velocity = useMotionValue(0);
  const direction = useMotionValue<'up' | 'down' | null>(null);
  const prev = useRef(0);

  useEffect(() => {
    return subscribeFrame((_, dt) => {
      const { top, scrollable } = readScroll(containerRef?.current);
      scrollY.set(top);
      progress.set(scrollable > 0 ? top / scrollable : 0);
      velocity.set(dt > 0 ? (top - prev.current) / dt : 0);
      direction.set(prev.current > top ? 'up' : prev.current < top ? 'down' : null);
      prev.current = top;
    });
  }, [containerRef, scrollY, progress, velocity, direction]);

  return { scrollY, scrollYProgress: progress, velocity, direction };
}

/* ------------------------------- parallax ------------------------------- */

export interface ParallaxOptions extends ScrollOptions {
  /** Travel distance at full scroll (px). Element-relative. */
  strength?: number;
  axis?: 'x' | 'y';
  spring?: boolean;
}

export interface ParallaxResult {
  ref: RefObject<HTMLElement | null>;
  /** Current [-1, 1] position across the viewport. */
  offset: MotionValue<number>;
}

/**
 * Parallax the bound element against the scroll position. The element's own
 * document position drives the offset — elements scroll at different rates
 * based on where they sit, so layered motion (principle: Continuity) works.
 */
export function useParallax(options: ParallaxOptions = {}): ParallaxResult {
  const { strength = 40, axis = 'y', containerRef } = options;
  const ref = useRef<HTMLElement | null>(null);
  const offset = useMotionValue(0);

  useEffect(() => {
    return subscribeFrame(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = typeof window !== 'undefined' ? window.innerHeight || 1 : 1;
      const center = rect.top + rect.height / 2;
      const normalized = center / vh;
      const value = Math.round(clamp(normalized * 2 - 1, -1, 1) * 100) / 100;
      offset.set(value);
      if (strength === 0) return;
      const shift = value * strength;
      if (!el.style.transform) el.style.transform = '';
      if (axis === 'y') el.style.transform = `translate3d(0, ${shift}px, 0)`;
      else el.style.transform = `translate3d(${shift}px, 0, 0)`;
    });
  }, [strength, axis, containerRef, offset]);

  return { ref, offset };
}

/* -------------------------------- reveal --------------------------------- */

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none';

export interface RevealOptions {
  direction?: RevealDirection;
  distance?: number;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

export interface RevealResult {
  ref: RefObject<HTMLElement | null>;
  revealed: boolean;
  distance: number;
  direction: RevealDirection;
  delay: number;
}

const DIST_TO_OFFSET: Record<Exclude<RevealDirection, 'none'>, (px: number) => MotionStyleValues> = {
  up: (px) => ({ y: px, opacity: 0 }),
  down: (px) => ({ y: -px, opacity: 0 }),
  left: (px) => ({ x: px, opacity: 0 }),
  right: (px) => ({ x: -px, opacity: 0 }),
};

/** Reveal-on-scroll authored motion: hidden → visible with configurable entry. */
export function useReveal(options: RevealOptions = {}): RevealResult {
  const { direction = 'up', distance = 24, threshold = 0.2, rootMargin = '0px', once = true } = options;
  const inView = useInView<HTMLElement>({ once, threshold, rootMargin });
  const from = direction === 'none' ? undefined : DIST_TO_OFFSET[direction](distance);
  void from;
  return { ref: inView.ref, revealed: inView.inView, distance, direction, delay: 0 };
}

/** Entry projection for a reveal — used by <Reveal> to author the from-style. */
export function revealFrom(direction: RevealDirection, distance: number): MotionStyleValues | undefined {
  if (direction === 'none') return undefined;
  return DIST_TO_OFFSET[direction](distance);
}

/* -------------------------------- sticky -------------------------------- */

export interface StickyResult {
  ref: RefObject<HTMLElement | null>;
  stuck: boolean;
}

/** True once the bound element reaches `top` on scroll (sticky-header cue). */
export function useSticky(options: { top?: number; enabled?: boolean; onChange?: (stuck: boolean) => void; containerRef?: RefObject<HTMLElement | null> } = {}): StickyResult {
  const { top = 0, enabled = true, onChange, containerRef } = options;
  const ref = useRef<HTMLElement | null>(null);
  const [stuck, setStuck] = useState(false);
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return;
    return subscribeFrame(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = rect.top <= top;
      setStuck((prev) => {
        if (prev !== next) cbRef.current?.(next);
        return next;
      });
    });
  }, [top, enabled, containerRef]);

  return { ref, stuck };
}

/* ------------------------------- scroll spy ------------------------------ */

/** Track which section is active while scrolling (nearest section above offset). */
export function useScrollSpy<T extends HTMLElement>(ids: string[], options: { offset?: number; containerRef?: RefObject<HTMLElement | null> } = {}): {
  activeId: string | null;
  register: (id: string) => RefObject<T | null>;
} {
  const { offset = 80, containerRef } = options;
  const [activeId, setActiveId] = useState<string | null>(null);
  const refs = useRef(new Map<string, RefObject<T | null>>());

  const register = useCallback((id: string) => {
    if (!refs.current.has(id)) refs.current.set(id, { current: null });
    return refs.current.get(id)!;
  }, []);

  useEffect(() => {
    return subscribeFrame(() => {
      const { top } = readScroll(containerRef?.current);
      let current: string | null = null;
      for (const id of ids) {
        const el = refs.current.get(id)?.current;
        if (!el) continue;
        const absTop = el.getBoundingClientRect().top + (typeof window !== 'undefined' ? window.scrollY || 0 : 0);
        if (top + offset >= absTop) current = id;
      }
      setActiveId(current);
    });
  }, [ids, offset, containerRef]);

  return { activeId, register };
}

/* --------------------------- scrolled past / to -------------------------- */

/** True once the user has scrolled passed `threshold` px. Resets on back-scroll. */
export function useScrolledPast(threshold = 80): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    return subscribeFrame(() => {
      const { top } = readScroll(undefined);
      setPast(top > threshold);
    });
  }, [threshold]);
  return past;
}

/* ------------------------------ infinite scroll -------------------------- */

export interface InfiniteScrollOptions {
  onLoadMore: () => void | Promise<unknown>;
  hasMore?: boolean;
  rootMargin?: string;
  disabled?: boolean;
}

export interface InfiniteScrollResult {
  /** Sentinel; attach to the element that triggers the next page. */
  ref: RefObject<HTMLDivElement | null>;
  loading: boolean;
  loadMore: () => void;
}

/** Append-more sentinel that fires `onLoadMore` every time it nears the viewport. */
export function useInfiniteScroll(options: InfiniteScrollOptions): InfiniteScrollResult {
  const { onLoadMore, hasMore = true, rootMargin = '200px', disabled = false } = options;
  const ref = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);
  const cbRef = useRef(onLoadMore);
  useEffect(() => {
    cbRef.current = onLoadMore;
  });
  const cfgRef = useRef({ hasMore, disabled });
  useEffect(() => {
    cfgRef.current = { hasMore, disabled };
  }, [hasMore, disabled]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !cfgRef.current.hasMore || cfgRef.current.disabled) return;
    busyRef.current = true;
    setLoading(true);
    try {
      await cbRef.current();
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, loadMore]);

  return { ref, loading, loadMore };
}

/** Imperative scroll-to (smooth) for anchors, tabs and buttons. */
export function scrollToTarget(target: HTMLElement | string, options: { block?: ScrollLogicalPosition; behavior?: ScrollBehavior } = {}): void {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  el?.scrollIntoView?.({ behavior: options.behavior ?? 'smooth', block: options.block ?? 'start' });
}