import { useCallback, useEffect, useId as useReactId, useLayoutEffect, useRef, useState } from 'react';

/**
 * WCO React hooks — the behavioral foundation for the advanced component
 * library. Each hook is dependency-light, SSR-safe, and unit-tested.
 */

/**
 * `useId` — stable, SSR-safe id generator. Returns a stable scoped id on the
 * server and an incrementing unique id on the client (no hydration mismatch).
 */
export function useId(prefix?: string): string {
  const reactId = useReactId();
  return prefix ? `${prefix}-${reactId.replace(/:/g, '')}` : reactId.replace(/:/g, '');
}

/**
 * `useControllableState` — supports both controlled (`value`+`onChange`) and
 * uncontrolled (default) usage for any component, with a clean `onChange`.
 */
export function useControllableState<T>(options: {
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
}): [T, (value: T) => void] {
  const { value, defaultValue, onChange } = options;
  const [internal, setInternal] = useState<T | undefined>(defaultValue as T);

  const isControlled = value !== undefined;
  const current = (isControlled ? value : internal) as T;

  const setValue = useCallback(
    (next: T) => {
      if (!Object.is(current, next)) {
        if (!isControlled) setInternal(next);
        onChange?.(next);
      }
    },
    [current, isControlled, onChange],
  );

  return [current, setValue];
}

/**
 * `useClickOutside` — calls `onOutside` when a pointer/click occurs outside
 * `ref`. Used by popovers, dropdowns, menus, closes.
 */
export function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || (!(e.target as Node).isConnected)) return;
      if (el.contains(e.target as Node)) return;
      onOutside();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [ref, onOutside, enabled]);
}

/**
 * `useMediaQuery` — reactive CSS media-query match. SSR-safe (defaults to
 * `defaultValue` until mounted in the browser).
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);
  const mqlRef = useRef<MediaQueryList | null>(null);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    mqlRef.current = mql;
    setMatches(mql.matches);
    const handle = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handle);
    return () => mql.removeEventListener('change', handle);
  }, [query]);

  return matches;
}

/** Hook + data combo of the five breakpoints (from design-tokens/layout-system). */
export const BREAKPOINTS = { base: 0, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;
export type BreakpointName = keyof typeof BREAKPOINTS;

/**
 * `useBreakpoint` — returns the nearest active breakpoint name and whether
 * the viewport is at least `atLeast`. SSR-safe.
 */
export function useBreakpoint(): { breakpoint: BreakpointName; isMobile: boolean; isTablet: boolean; isDesktop: boolean; atLeast: (b: BreakpointName) => boolean } {
  const [width, setWidth] = useState<number>(0);
  useLayoutEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const order: BreakpointName[] = ['base', 'sm', 'md', 'lg', 'xl', '2xl'];
  let bp: BreakpointName = 'base';
  for (const b of order) {
    if (width >= BREAKPOINTS[b]) bp = b;
  }
  const atLeast = useCallback(
    (b: BreakpointName) => width === 0 ? false : width >= BREAKPOINTS[b],
    [width],
  );
  return {
    breakpoint: bp,
    isMobile: width !== 0 && width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    atLeast,
  };
}

/** `useReducedMotion` — respects `prefers-reduced-motion`. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)', false);
}

/**
 * `useKey` — calls `handler` when `key` is pressed (optionally with modifiers).
 * Returns an `onKeyDown` handler to attach.
 */
export function useKey(key: string, handler: (e: React.KeyboardEvent) => void) {
  return useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === key) handler(e);
    },
    [key, handler],
  );
}

/** `useDebouncedValue` — returns `value` after `delay` ms of no change. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * `useCounter` — a controlled/uncontrolled counter with min/max/step and
 * `increment`/`decrement`/`set`. Used by NumberInput, OTP resend, etc.
 */
export function useCounter(options: { value?: number; defaultValue?: number; min?: number; max?: number; step?: number; onChange?: (v: number) => void }) {
  const { min = -Infinity, max = Infinity, step = 1 } = options;
  const [current, setValue] = useControllableState<number>({
    value: options.value,
    defaultValue: options.defaultValue ?? 0,
    onChange: options.onChange,
  });
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, n)), [min, max]);
  const increment = useCallback(() => setValue(clamp(current + step)), [current, step, clamp, setValue]);
  const decrement = useCallback(() => setValue(clamp(current - step)), [current, step, clamp, setValue]);
  return { value: current, increment, decrement, set: (v: number) => setValue(clamp(v)), clampedValue: clamp };
}

/** `useInterval` — runs `callback` every `delay` ms (null disables). */
export function useInterval(callback: () => void, delay: number | null) {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/** `useIsomorphicLayoutEffect` — SSR-safe layout effect. */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** `useScrollLock` — locks body scroll while active (modals, sheets). */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}

/**
 * `useFocusTrap` — traps Tab/Shift+Tab within `ref` while `active`. Returns the
 * `focusContainerRef` to attach. Call `focusFirst()` when opening.
 */
export function useFocusTrap(active = true): {
  focusContainerRef: React.RefObject<HTMLDivElement | null>;
  focusFirst: () => void;
  focusLast: () => void;
} {
  const ref = useRef<HTMLDivElement | null>(null);

  const getFocusables = useCallback(() => {
    if (!ref.current) return [];
    return Array.from(
      ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('hidden'));
  }, []);

  const focusFirst = useCallback(() => {
    const els = getFocusables();
    els[0]?.focus();
  }, [getFocusables]);

  const focusLast = useCallback(() => {
    const els = getFocusables();
    els[els.length - 1]?.focus();
  }, [getFocusables]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = getFocusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (activeEl === first || !ref.current?.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (activeEl === last || !ref.current?.contains(activeEl))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, getFocusables]);

  return { focusContainerRef: ref, focusFirst, focusLast };
}

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'auto';

/**
 * `usePopoverPosition` — computes a `{ top, left }` position for a popover
 * relative to a trigger, given a placement. A tiny, dependency-free flip.
 */
export function usePopoverPosition(triggerRef: React.RefObject<HTMLElement | null>, popoverRef: React.RefObject<HTMLElement | null>, placement: Placement, open: boolean) {
  const compute = useCallback((): { top: number; left: number } => {
    const trigger = triggerRef.current;
    const pop = popoverRef.current;
    if (!trigger) return { top: 0, left: 0 };
    const t = trigger.getBoundingClientRect();
    const p = { width: pop?.offsetWidth ?? 220, height: pop?.offsetHeight ?? 0 };
    const gap = 8;
    let top = 0;
    let left = 0;
    const place = placement === 'auto' ? 'bottom' : placement;

    if (place.startsWith('bottom')) {
      top = t.bottom + gap;
      left = place === 'bottom' ? t.left + t.width / 2 - p.width / 2 : place === 'bottom-start' ? t.left : t.left + t.width - p.width;
    } else if (place.startsWith('top')) {
      top = t.top - p.height - gap;
      left = place === 'top' ? t.left + t.width / 2 - p.width / 2 : place === 'top-start' ? t.left : t.left + t.width - p.width;
    } else if (place === 'left') {
      top = t.top + t.height / 2 - p.height / 2;
      left = t.left - p.width - gap;
    } else if (place === 'right') {
      top = t.top + t.height / 2 - p.height / 2;
      left = t.right + gap;
    }
    // Keep within viewport
    if (typeof window !== 'undefined') {
      left = Math.max(8, Math.min(left, window.innerWidth - p.width - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - 8));
    }
    return { top, left };
  }, [triggerRef, popoverRef, placement]);

  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => setPos(compute());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, compute]);

  return pos;
}

/**
 * `useRovingTabIndex` — ARIA roving tabindex for listbox/menus/tabs groups.
 * Returns handlers + the current focused index. Reduced-motion safe: uses
 * focus, never animates.
 */
export function useRovingTabIndex(total: number) {
  const [active, setActive] = useState(0);
  const move = useCallback(
    (dir: 1 | -1) => {
      setActive((a) => (a + dir + total) % total);
    },
    [total],
  );
  return { active, setActive, move };
}

/**
 * `usePrevious` — returns the previous value.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
