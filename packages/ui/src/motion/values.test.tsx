import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MotionProvider,
  useMotionPrefs,
  useReducedMotionPref,
  useMotionValue,
  useMotionValueRender,
  useSpring,
  useSpringFrom,
  useTween,
  useTimeline,
  timelineValueAt,
  useSequence,
  useStagger,
  useCascade,
  useCount,
  useCycle,
} from './values';
import { MotionValue } from './core';
import { __resetFrames, __setManualFrames, __tickFrame } from './raf';

let t = 0;

beforeEach(() => {
  __setManualFrames(true);
  t = 0;
});
afterEach(() => __resetFrames());

// Warm-up: manual first frame carries dt 0, so ticks below are exact deltas.
const seed = () => {
  t += 1;
  __tickFrame(2000 + t * 16);
};
// Steady 16ms cadence for spring settling loops.
const tick = () => {
  t += 1;
  __tickFrame(2000 + t * 16);
};

describe('motion/values provider & prefs', () => {
  it('defaults to the OS preference (unavailable → false)', () => {
    const { result } = renderHook(() => useMotionPrefs());
    expect(result.current.reduced).toBe(false);
    expect(result.current.rate).toBe(1);
    expect(result.current.forced).toBe(false);
  });

  it('provider forces reduced motion for the subtree', () => {
    const { result } = renderHook(() => useMotionPrefs(), { wrapper: ({ children }) => <MotionProvider reduced>{children}</MotionProvider> });
    expect(result.current.reduced).toBe(true);
    expect(result.current.forced).toBe(true);
  });

  it('exposes fuse/reduced flag reactively', () => {
    const { result } = renderHook(() => useReducedMotionPref(), { wrapper: ({ children }) => <MotionProvider reduced>{children}</MotionProvider> });
    expect(result.current).toBe(true);
  });
});

describe('motion/values springs', () => {
  it('chases a changing target and settles on it', () => {
    const { result, rerender } = renderHook(({ target }) => useSpring(target, { stiffness: 170, damping: 26 }), { initialProps: { target: 0 } });
    rerender({ target: 100 });
    act(() => {
      for (let i = 0; i < 300; i += 1) tick();
    });
    expect(Math.abs(result.current.get() - 100)).toBeLessThan(1);
  });

  it('respects threshold (no physics below it)', () => {
    const { result, rerender } = renderHook(({ target }) => useSpring(target, { threshold: 10 }), { initialProps: { target: 0 } });
    rerender({ target: 5 });
    act(() => tick());
    expect(result.current.get()).toBe(5);
  });

  it('snaps instantly when the provider requests reduced motion', () => {
    const { result, rerender } = renderHook(({ target }) => useSpring(target, { stiffness: 170, damping: 26 }), {
      initialProps: { target: 0 },
      wrapper: ({ children }) => <MotionProvider reduced>{children}</MotionProvider>,
    });
    rerender({ target: 100 });
    act(() => tick());
    expect(result.current.get()).toBe(100);
  });

  it('useSpringFrom chases a flowing motion value', () => {
    const target = new MotionValue(0);
    const { result } = renderHook(() => useSpringFrom(target, { stiffness: 170, damping: 26 }));
    target.set(50);
    act(() => {
      for (let i = 0; i < 150; i += 1) tick();
    });
    expect(Math.round(result.current.get())).toBe(50);
  });
});

describe('motion/values tweens', () => {
  it('interpolates through an eased tween and reports active state', () => {
    const { result } = renderHook(() => useTween({ from: 0, to: 100, duration: 1000, ease: 'linear' }));
    act(() => result.current.play());
    expect(result.current.active).toBe(true);
    act(() => __tickFrame(2000)); // warm-up (dt 0)
    act(() => __tickFrame(2500)); // +500ms across the 1000ms tween
    expect(result.current.value.get()).toBeCloseTo(50, 3);
    act(() => __tickFrame(3500)); // finish
    expect(result.current.value.get()).toBe(100);
    expect(result.current.active).toBe(false);
  });

  it('defers to a configured delay', () => {
    const { result } = renderHook(() => useTween({ from: 0, to: 10, duration: 100, ease: 'linear' }));
    act(() => result.current.play({ delay: 100 }));
    act(() => __tickFrame(2000));
    expect(result.current.value.get()).toBe(0);
    act(() => __tickFrame(2100)); // +100ms: delay consumed, animation not started
    expect(result.current.value.get()).toBe(0);
    act(() => __tickFrame(2200)); // +100ms of animation → completes
    expect(result.current.value.get()).toBe(10);
  });

  it('loops and mirrors while configured', () => {
    const { result } = renderHook(() => useTween({ from: 0, to: 10, duration: 100, loop: 'mirror', counts: 2, ease: 'linear' }));
    act(() => result.current.play());
    act(() => __tickFrame(2000));
    act(() => __tickFrame(2100)); // 0 → 10 (100ms)
    expect(result.current.value.get()).toBeCloseTo(10, 3);
    act(() => __tickFrame(2120)); // mirrors back toward 0
    expect(result.current.value.get()).toBeLessThan(10);
    act(() => __tickFrame(2200)); // second leg finishes
    expect(result.current.value.get()).toBe(0);
    expect(result.current.active).toBe(false);
  });

  it('completes instantly under reduced motion', () => {
    const onComplete = () => undefined;
    const { result } = renderHook(() => useTween({ from: 0, to: 100, duration: 1000, ease: 'linear', onComplete }), {
      wrapper: ({ children }) => <MotionProvider reduced>{children}</MotionProvider>,
    });
    act(() => result.current.play());
    expect(result.current.value.get()).toBe(100);
    expect(result.current.active).toBe(false);
    act(() => __tickFrame(7000));
    expect(result.current.value.get()).toBe(100);
  });

  it('stop() pauses the animation in place', () => {
    const { result } = renderHook(() => useTween({ from: 0, to: 100, duration: 1000, ease: 'linear' }));
    act(() => result.current.play());
    act(() => __tickFrame(8000));
    act(() => __tickFrame(8100)); // +100ms → t = 0.1 (linear) → 10
    const held = result.current.value.get();
    expect(held).toBeGreaterThan(0);
    act(() => result.current.stop());
    act(() => __tickFrame(8200));
    expect(result.current.value.get()).toBe(held);
  });
});

describe('motion/values timelines & sequences', () => {
  it('timelineValueAt splines through keyframes', () => {
    expect(timelineValueAt([{ at: 0, value: 0 }, { at: 1, value: 100 }], 0.5)).toBe(50);
    expect(timelineValueAt([{ at: 0, value: 0 }, { at: 1, value: 100 }], 0)).toBe(0);
    expect(timelineValueAt([{ at: 0, value: 0 }, { at: 1, value: 100 }], 1.2)).toBe(100);
  });

  it('plays a timeline end to end', () => {
    const { result } = renderHook(() =>
      useTimeline({
        points: [
          { at: 0, value: 0, ease: 'linear' },
          { at: 0.5, value: 10, ease: 'linear' },
          { at: 1, value: 0, ease: 'linear' },
        ],
        duration: 1000,
      }),
    );
    act(() => result.current.play());
    act(() => __tickFrame(5000));
    act(() => __tickFrame(5500)); // +500ms → t = 0.5
    expect(result.current.value.get()).toBeCloseTo(10, 3);
    act(() => __tickFrame(6500)); // +1000ms → t = 1
    expect(result.current.value.get()).toBeCloseTo(0, 3);
    expect(result.current.active).toBe(false);
  });

  it('runs sequence steps back-to-back', () => {
    const { result } = renderHook(() => useSequence([{ to: 10, from: 0, duration: 100 }, { to: 20, from: 10, duration: 100 }]));
    act(() => result.current.play());
    act(() => __tickFrame(7000));
    act(() => __tickFrame(7100)); // +100ms → first step computes t=1 next frame
    act(() => __tickFrame(7150)); // first step completes at 10; second starts
    expect(result.current.value.get()).toBeCloseTo(10, 3);
    act(() => __tickFrame(7200)); // second step, halfway (linear ease)
    expect(result.current.value.get()).toBe(10);
    act(() => __tickFrame(7250));
    expect(result.current.value.get()).toBeGreaterThan(10);
    act(() => __tickFrame(7300)); // second step computes t=1
    expect(result.current.value.get()).toBeCloseTo(20, 3);
    act(() => __tickFrame(7350)); // loop notices exhaustion and stops
    expect(result.current.active).toBe(false);
  });
});

describe('motion/values staple helpers', () => {
  it('useStagger fans from start, end and middle', () => {
    const { result: start } = renderHook(() => useStagger({ count: 3, interval: 50 }));
    expect(start.current.delays).toEqual([0, 50, 100]);
    const { result: end } = renderHook(() => useStagger({ count: 3, interval: 50, from: 'end' }));
    expect(end.current.delays).toEqual([100, 50, 0]);
    const { result: mid } = renderHook(() => useStagger({ count: 3, interval: 40, from: 'middle' }));
    expect(mid.current.delays[1]).toBe(0);
    expect(mid.current.delays[0]).toBe(40);
  });

  it('useCascade keeps delays once visible (IO absent → visible)', () => {
    const { result } = renderHook(() => useCascade(3, { interval: 40 }));
    expect(result.current.visible).toBe(true);
    expect(result.current.delays).toEqual([0, 40, 80]);
  });

  it('useCount counts up with formatting', () => {
    const { result } = renderHook(() => useCount(1000, { from: 0, duration: 100, ease: 'linear', format: (n) => `$${Math.round(n)}` }));
    act(() => result.current.play());
    act(() => __tickFrame(8000));
    expect(result.current.formatted).toBe('$0');
    act(() => __tickFrame(8100)); // +100ms → completes
    expect(result.current.formatted).toBe('$1000');
    expect(result.current.value).toBe(1000);
  });

  it('useCycle wraps forward and backward', () => {
    const { result } = renderHook(() => useCycle(['a', 'b', 'c'] as const));
    expect(result.current.state).toBe('a');
    act(() => result.current.next());
    expect(result.current.state).toBe('b');
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.state).toBe('a');
    act(() => result.current.prev());
    expect(result.current.state).toBe('c');
  });

  it('useMotionValueRender re-renders on external updates', () => {
    const mv = new MotionValue(0);
    const Probe = () => <span data-testid="v">{useMotionValueRender(mv)}</span>;
    render(<Probe />);
    const span = document.querySelector('[data-testid="v"]');
    expect(span?.textContent).toBe('0');
    act(() => mv.set(42));
    expect(span?.textContent).toBe('42');
    act(() => mv.set(42));
    expect(span?.textContent).toBe('42');
  });
});