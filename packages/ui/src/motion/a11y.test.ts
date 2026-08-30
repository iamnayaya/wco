import { afterEach, describe, expect, it } from 'vitest';
import {
  REDUCED_MOTION_QUERY,
  collapseMotion,
  getPrefersReducedMotion,
  motionSafeStyle,
  shouldAnimate,
} from './a11y';

afterEach(() => {
  // @ts-expect-error configurable per-test stub
  delete window.matchMedia;
});

describe('motion/a11y', () => {
  it('exposes the canonical reduced-motion query', () => {
    expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
  });

  it('reads the OS preference safely (no matchMedia → false)', () => {
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true });
    expect(getPrefersReducedMotion()).toBe(false);
  });

  it('reads the OS preference via matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true }),
    });
    expect(getPrefersReducedMotion()).toBe(true);
  });

  it('shouldAnimate bails on reduced, frozen or paused policy', () => {
    expect(shouldAnimate({ reduced: false, frozen: false, rate: 1 })).toBe(true);
    expect(shouldAnimate({ reduced: true, frozen: false, rate: 1 })).toBe(false);
    expect(shouldAnimate({ reduced: false, frozen: true, rate: 1 })).toBe(false);
    expect(shouldAnimate({ reduced: false, frozen: false, rate: 0 })).toBe(false);
  });

  it('motionSafeStyle keeps layout but strips animation props under reduced motion', () => {
    const full = { padding: 12, animation: 'pulse 1s infinite', transition: 'opacity 200ms', willChange: 'transform' } as React.CSSProperties;
    expect(motionSafeStyle(false, full)).toEqual({ padding: 12, animation: 'pulse 1s infinite', transition: 'opacity 200ms', willChange: 'transform' });
    expect(motionSafeStyle(true, full)).toEqual({ padding: 12 });
  });

  it('collapseMotion maps every key onto its resting state', () => {
    expect(
      collapseMotion({
        opacity: 0,
        x: 40,
        y: -24,
        scale: 0.9,
        scaleX: 0.5,
        scaleY: 1.1,
        rotate: 12,
        rotateX: 20,
        rotateY: 30,
        blur: 4,
        grayscale: 0.5,
        sepia: 0.3,
        brightness: 0.7,
      }),
    ).toEqual({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      rotateX: 0,
      rotateY: 0,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      brightness: 1,
    });
  });

  it('collapseMotion ignores absent keys', () => {
    expect(collapseMotion({ opacity: 0 })).toEqual({ opacity: 1 });
  });
});