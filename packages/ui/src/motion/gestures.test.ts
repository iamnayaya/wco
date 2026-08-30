import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTap, useHover, useFocus, useSwipe, usePinch, useDrag, useMove, useScale, useResize } from './gestures';
import { __resetFrames, __tickFrame } from './raf';

type PE = {
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
  currentTarget: unknown;
  target: unknown;
};

const el = { setPointerCapture: undefined, getBoundingClientRect: () => ({ left: 10, top: 10, width: 100, height: 40 }) };
const pe = (clientX: number, clientY: number, pointerId = 1): PE => ({ clientX, clientY, pointerId, pointerType: 'touch', currentTarget: el, target: el });

describe('motion/gestures tap', () => {
  beforeEach(() => __resetFrames());

  it('recognises a tap and reports coordinates', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() => useTap({ onTap }));
    act(() => result.current.bind.onPointerDown?.(pe(10, 10) as never));
    act(() => result.current.bind.onPointerUp?.(pe(12, 12) as never));
    expect(onTap).toHaveBeenCalledWith({ x: 12, y: 12 });
  });

  it('detects double taps within the window', () => {
    const onDoubleTap = vi.fn();
    const { result } = renderHook(() => useTap({ onDoubleTap, doubleTapDelay: 300, onTap: () => undefined }));
    act(() => result.current.bind.onPointerDown?.(pe(0, 0) as never));
    act(() => result.current.bind.onPointerUp?.(pe(0, 0) as never));
    act(() => result.current.bind.onPointerDown?.(pe(0, 0) as never));
    act(() => result.current.bind.onPointerUp?.(pe(0, 0) as never));
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('treats larger excursions as a drag, not a tap', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() => useTap({ onTap, maxTapMovement: 8 }));
    act(() => result.current.bind.onPointerDown?.(pe(0, 0) as never));
    act(() => result.current.bind.onPointerMove?.(pe(40, 0) as never));
    act(() => result.current.bind.onPointerUp?.(pe(40, 0) as never));
    expect(onTap).not.toHaveBeenCalled();
  });

  it('responds to keyboard activation and reports pressed state', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() => useTap({ onTap }));
    expect(result.current.bind.role).toBe('button');
    act(() => result.current.bind.onKeyDown?.({ key: 'Enter', preventDefault: vi.fn() } as never));
    expect(onTap).toHaveBeenCalled();
    expect(result.current.bind.tabIndex).toBe(0);
  });

  it('respects disabled and long-press', () => {
    const onTap = vi.fn();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useTap({ onTap, onLongPress, longPressDelay: 60 }));
    vi.useFakeTimers();
    const down = pe(0, 0);
    act(() => result.current.bind.onPointerDown?.(down as never));
    act(() => vi.advanceTimersByTime(80));
    expect(onLongPress).toHaveBeenCalled();
    vi.useRealTimers();
    const { result: disabled } = renderHook(() => useTap({ onTap, disabled: true }));
    act(() => disabled.current.bind.onPointerDown?.(pe(0, 0) as never));
    act(() => disabled.current.bind.onPointerUp?.(pe(0, 0) as never));
    expect(onTap).toHaveBeenCalledTimes(0);
  });
});

describe('motion/gestures hover & focus', () => {
  it('tracks hover enter/leave', () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const { result } = renderHook(() => useHover({ onEnter, onLeave }));
    act(() => result.current.bind.onMouseEnter?.({} as never));
    expect(result.current.hovered).toBe(true);
    expect(onEnter).toHaveBeenCalled();
    act(() => result.current.bind.onMouseLeave?.({} as never));
    expect(result.current.hovered).toBe(false);
    expect(onLeave).toHaveBeenCalled();
  });

  it('exposes focus states and only claims focus-visible after keyboard use', () => {
    const { result } = renderHook(() => useFocus({}));
    act(() => result.current.bind.onFocus?.({} as never));
    expect(result.current.focused).toBe(true);
    expect(result.current.focusVisible).toBe(false);
    act(() => result.current.bind.onBlur?.({} as never));
    expect(result.current.focused).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    act(() => result.current.bind.onFocus?.({} as never));
    expect(result.current.focusVisible).toBe(true);
    document.dispatchEvent(new KeyboardEvent('pointerdown'));
    act(() => result.current.bind.onBlur?.({} as never));
    act(() => result.current.bind.onFocus?.({} as never));
    expect(result.current.focusVisible).toBe(false);
  });
});

describe('motion/gestures swipe & pinch', () => {
  it('reports dominant direction after a thresholded swipe', () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipe, threshold: 24 }));
    act(() => result.current.bind.onPointerDown?.(pe(100, 100, 1) as never));
    act(() => result.current.bind.onPointerMove?.(pe(40, 100, 1) as never));
    act(() => result.current.bind.onPointerUp?.(pe(40, 100, 1) as never));
    expect(onSwipe).toHaveBeenCalledTimes(1);
    const d = onSwipe.mock.calls[0][0] as { direction: string; deltaX: number };
    expect(d.direction).toBe('left');
    expect(d.deltaX).toBeLessThan(0);
  });

  it('does not fire below threshold', () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipe, threshold: 100 }));
    act(() => result.current.bind.onPointerDown?.(pe(0, 0, 1) as never));
    act(() => result.current.bind.onPointerMove?.(pe(20, 0, 1) as never));
    act(() => result.current.bind.onPointerUp?.(pe(20, 0, 1) as never));
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('computes pinch scale and rotation from two pointers', () => {
    const onPinch = vi.fn();
    const { result } = renderHook(() => usePinch({ onPinch }));
    act(() => result.current.bind.onPointerDown?.(pe(100, 100, 1) as never));
    act(() => result.current.bind.onPointerDown?.(pe(200, 100, 2) as never));
    expect(result.current.pinching).toBe(true);
    act(() => result.current.bind.onPointerMove?.(pe(200, 100, 2) as never));
    act(() => result.current.bind.onPointerMove?.(pe(100, 100, 1) as never));
    act(() => result.current.bind.onPointerMove?.(pe(110, 100, 2) as never));
    expect(result.current.scale.get()).toBeCloseTo(0.1, 5);
    expect(onPinch).toHaveBeenCalled();
    act(() => result.current.bind.onPointerUp?.(pe(110, 100, 2) as never));
    expect(result.current.pinching).toBe(false);
  });
});

describe('motion/gestures drag', () => {
  beforeEach(() => __resetFrames());

  it('clamps motion to configured bounds', () => {
    const { result } = renderHook(() => useDrag({ axis: 'x', min: 0, max: 80, momentum: false }));
    act(() => result.current.bind.onPointerDown?.(pe(10, 10, 1) as never));
    act(() => result.current.bind.onPointerMove?.(pe(60, 15, 1) as never));
    expect(result.current.x.get()).toBe(50);
    act(() => result.current.bind.onPointerMove?.(pe(120, 15, 1) as never));
    expect(result.current.x.get()).toBe(80);
    expect(result.current.y.get()).toBe(0);
    act(() => result.current.bind.onPointerUp?.(pe(120, 15, 1) as never));
    expect(result.current.dragging).toBe(false);
  });

  it('settles back to a legal position when released out of bounds', () => {
    const onDragEnd = vi.fn();
    const { result } = renderHook(() => useDrag({ axis: 'x', min: 0, max: 40, momentum: false, onDragEnd }));
    act(() => result.current.bind.onPointerDown?.(pe(0, 0, 1) as never));
    act(() => result.current.bind.onPointerMove?.(pe(120, 0, 1) as never));
    expect(result.current.x.get()).toBe(40);
    act(() => result.current.bind.onPointerUp?.(pe(120, 0, 1) as never));
    expect(onDragEnd).toHaveBeenCalledWith({ x: 40, y: 0 });
  });

  it('flings then decays within bounds through the frame loop', () => {
    const { result } = renderHook(() => useDrag({ axis: 'y', min: -200, max: 200, momentum: true }));
    act(() => result.current.bind.onPointerDown?.(pe(0, 0, 1) as never));
    act(() => result.current.bind.onPointerMove?.(pe(0, 40, 1) as never));
    act(() => result.current.bind.onPointerMove?.(pe(0, 90, 1) as never));
    act(() => result.current.bind.onPointerUp?.(pe(0, 90, 1) as never));
    act(() => {
      for (let i = 1; i <= 400; i += 1) __tickFrame(1000 + i * 16);
    });
    expect(Math.abs(result.current.y.get())).toBeLessThanOrEqual(200);
  });
});

describe('motion/gestures move & scale & resize', () => {
  it('normalizes pointer position onto [-1, 1]', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useMove({ onMove }));
    act(() => result.current.bind.onPointerMove?.(pe(60, 30, 1) as never));
    expect(result.current.x.get()).toBeCloseTo(0, 5);
    expect(result.current.y.get()).toBeCloseTo(0, 5);
    act(() => result.current.bind.onPointerMove?.(pe(110, 10, 1) as never));
    expect(result.current.x.get()).toBeCloseTo(1, 5);
    expect(onMove).toHaveBeenCalled();
  });

  it('maps drag distance to scale within clamps', () => {
    const { result } = renderHook(() => useScale({ sensitivity: 0.01, min: 0.5, max: 2 }));
    act(() => result.current.bind.onPointerDown?.(pe(0, 50, 1) as never));
    act(() => result.current.bind.onPointerMove?.(pe(0, 10, 1) as never));
    expect(result.current.scale.get()).toBeCloseTo(0.6, 5);
    act(() => result.current.bind.onPointerUp?.(pe(0, 10, 1) as never));
    expect(result.current.scaling).toBe(false);
  });

  it('measures element size via measure() when ResizeObserver is absent', () => {
    const { result } = renderHook(() => useResize({}));
    (result.current.ref as React.MutableRefObject<unknown>).current = {
      getBoundingClientRect: () => ({ width: 300, height: 200 }),
      offsetWidth: 300,
      offsetHeight: 200,
    };
    act(() => result.current.measure());
    expect(result.current.width.get()).toBe(300);
    expect(result.current.height.get()).toBe(200);
  });
});