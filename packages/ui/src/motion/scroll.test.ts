import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetFrames, __tickFrame } from './raf';
import { useScroll, useParallax, useReveal, useSticky, useScrollSpy, useScrolledPast, useInfiniteScroll, revealFrom } from './scroll';

function withScrollable(): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true });
  document.body.appendChild(el);
  return el;
}

beforeEach(() => __resetFrames());
afterEach(() => {
  __resetFrames();
  vi.clearAllMocks();
});

describe('motion/scroll useScroll', () => {
  it('reports position, normalized progress and direction from a container', () => {
    const el = withScrollable();
    const { result } = renderHook(() => useScroll({ containerRef: { current: el } }));
    el.scrollTop = 300;
    act(() => __tickFrame(1000));
    expect(result.current.scrollY.get()).toBeCloseTo(300, 5);
    expect(result.current.scrollYProgress.get()).toBeCloseTo(0.5, 5);
    expect(result.current.direction.get()).toBe('down');
    el.scrollTop = 100;
    act(() => __tickFrame(1016));
    expect(result.current.direction.get()).toBe('up');
    el.scrollTop = 100;
    act(() => __tickFrame(1032));
    expect(result.current.direction.get()).toBeNull();
    el.remove();
  });

  it('clamps progress to the scrollable range when not scrollable', () => {
    const { result } = renderHook(() => useScroll(
      { containerRef: { current: document.createElement('div') } } ,
    ));
    act(() => __tickFrame(1000));
    expect(result.current.scrollYProgress.get()).toBe(0);
  });
});

describe('motion/scroll reveal helpers', () => {
  it('authors proportional hidden states per direction', () => {
    expect(revealFrom('up', 24)).toEqual({ y: 24, opacity: 0 });
    expect(revealFrom('left', 40)?.x).toBe(40);
    expect(revealFrom('right', 16)?.x).toBe(-16);
    expect(revealFrom('none', 24)).toBeUndefined();
  });

  it('surfaces revealed state through IntersectionObserver when absent', () => {
    const { result } = renderHook(() => useReveal({ direction: 'up', distance: 32 }));
    expect(typeof result.current.ref).toBe('object');
    expect(result.current.revealed).toBe(true);
    expect(result.current.distance).toBe(32);
  });
});

describe('motion/scroll sticky & spy & past', () => {
  it('marks stuck when the element crosses the top edge', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ top: 100, bottom: 200, height: 100, left: 0, right: 100, width: 100, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(el);
    const { result } = renderHook(() => useSticky({ top: 40 }));
    act(() => {
      result.current.ref.current = el;
    });
    act(() => __tickFrame(1000));
    expect(result.current.stuck).toBe(false);
    el.getBoundingClientRect = () => ({ top: 30, bottom: 130, height: 100, left: 0, right: 100, width: 100, x: 0, y: 30, toJSON: () => ({}) }) as DOMRect;
    act(() => __tickFrame(1016));
    expect(result.current.stuck).toBe(true);
    el.remove();
  });

  it('reports scrolledPast against the threshold', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
    const { result } = renderHook(() => useScrolledPast(80));
    act(() => __tickFrame(1000));
    expect(result.current).toBe(true);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    act(() => __tickFrame(1016));
    expect(result.current).toBe(false);
  });

  it('spy activates the section under the read position', () => {
    const a = document.createElement('section');
    const b = document.createElement('section');
    a.id = 'intro';
    b.id = 'details';
    document.body.appendChild(a);
    document.body.appendChild(b);
    const rectA = { top: 0, bottom: 200, height: 200, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    const rectB = { top: 200, bottom: 400, height: 200, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    a.getBoundingClientRect = () => rectA;
    b.getBoundingClientRect = () => rectB;

    const { result } = renderHook(() => useScrollSpy(['intro', 'details'], { offset: 80 }));
    act(() => {
      const intro = result.current.register('intro') as { current: HTMLElement | null };
      const details = result.current.register('details') as { current: HTMLElement | null };
      intro.current = a;
      details.current = b;
    });
    act(() => __tickFrame(1000));
    expect(result.current.activeId).toBe('intro');
    // Scroll down: both sections move up in the viewport.
    rectA.top = -260;
    rectA.bottom = -60;
    rectA.y = -260;
    rectB.top = -60;
    rectB.bottom = 140;
    rectB.y = -60;
    act(() => __tickFrame(1016));
    expect(result.current.activeId).toBe('details');
    a.remove();
    b.remove();
  });
});

describe('motion/scroll infinite', () => {
  it('fails safe without IntersectionObserver and exposes manual loadMore', async () => {
    const onLoadMore = vi.fn(async () => undefined);
    const { result } = renderHook(() => useInfiniteScroll({ onLoadMore, hasMore: true }));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  it('dedupes concurrent loadMore calls', async () => {
    const onLoadMore = vi.fn(async () => new Promise((r) => setTimeout(r, 10)));
    const { result } = renderHook(() => useInfiniteScroll({ onLoadMore }));
    const p1 = act(async () => result.current.loadMore());
    await act(async () => result.current.loadMore());
    await p1;
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});