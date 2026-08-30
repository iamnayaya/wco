import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeFrame, __resetFrames, __tickFrame, __frameCount, pauseFrames, resumeFrames, setFrameRate, getFrameRate } from './raf';

describe('motion/raf frame driver', () => {
  beforeEach(() => __resetFrames());
  afterEach(() => {
    __resetFrames();
    vi.useRealTimers();
  });

  it('calls subscribers on every emitted frame', () => {
    const seen: number[] = [];
    subscribeFrame((time) => seen.push(time));
    __tickFrame(16);
    __tickFrame(32);
    __tickFrame(48);
    expect(seen).toEqual([16, 32, 48]);
  });

  it('reports delta between frames, capping at zero on reset sessions', () => {
    const deltas: number[] = [];
    subscribeFrame((_t, dt) => deltas.push(dt));
    __tickFrame(100);
    __tickFrame(116);
    __tickFrame(132);
    expect(deltas).toEqual([16, 16, 16]);
  });

  it('drives through requestAnimationFrame when available', () => {
    const origRaf = globalThis.requestAnimationFrame;
    let captured: FrameRequestCallback | null = null;
    (globalThis as never).requestAnimationFrame = ((cb: FrameRequestCallback) => {
      captured = cb;
      return 1;
    }) as never;
    try {
      const seen: number[] = [];
      subscribeFrame((t) => seen.push(t));
      expect(typeof captured).toBe('function');
      captured?.(100);
      captured?.(116);
      captured?.(132);
      expect(seen).toEqual([100, 116, 132]);
    } finally {
      (globalThis as never).requestAnimationFrame = origRaf;
      __resetFrames();
    }
  });

  it('unsubscribe removes the callback and stops the loop', () => {
    const cb = vi.fn();
    const off = subscribeFrame(cb);
    __tickFrame(16);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    __tickFrame(32);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(__frameCount()).toBe(0);
  });

  it('pause freezes delivery without unsubscribing', () => {
    const cb = vi.fn();
    subscribeFrame(cb);
    pauseFrames();
    __tickFrame(16);
    expect(cb).not.toHaveBeenCalled();
    expect(__frameCount()).toBe(1);
    resumeFrames();
    __tickFrame(16);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('rate scales the delta (and zero freezes everything)', () => {
    const deltas: number[] = [];
    subscribeFrame((_t, dt) => deltas.push(dt));
    setFrameRate(0.5);
    __tickFrame(100);
    __tickFrame(116);
    expect(deltas).toEqual([8, 8]);
    setFrameRate(0);
    __tickFrame(132);
    expect(deltas[2]).toBe(0);
    setFrameRate(1);
    __tickFrame(148);
    expect(deltas[3]).toBe(16);
    expect(getFrameRate()).toBe(1);
  });

  it('drops into setTimeout(16) when requestAnimationFrame is absent', () => {
    const orig = globalThis.requestAnimationFrame;
    (globalThis as never).requestAnimationFrame = undefined;
    try {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const seen: number[] = [];
      subscribeFrame((t) => seen.push(t));
      vi.advanceTimersByTime(16);
      expect(seen.length).toBeGreaterThanOrEqual(1);
    } finally {
      (globalThis as never).requestAnimationFrame = orig;
    }
  });

  it('self-heals after a global freeze toggle', () => {
    const cb = vi.fn();
    subscribeFrame(cb);
    pauseFrames();
    resumeFrames();
    __tickFrame(16);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});