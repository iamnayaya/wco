import { describe, expect, it } from 'vitest';
import {
  Animate,
  Cascade,
  CountUp,
  Fade,
  MotionProvider,
  Pressable,
  REDUCED_MOTION_QUERY,
  Reveal,
  Skeleton,
  SkeletonLoader,
  Slide,
  Spring,
  Stagger,
  Sticky,
  Tween,
  Zoom,
  collapseMotion,
  easingToFramer,
  getPrefersReducedMotion,
  loopToFramer,
  motionDuration,
  motionSafeStyle,
  presetToFramer,
  shouldAnimate,
  springToFramer,
  transitionToFramer,
  useInView,
  useScroll,
  useTween,
  duration,
} from './index';

describe('wco/ui public barrel', () => {
  it('exposes the motion components', () => {
    expect([Animate, Fade, Slide, Zoom, Reveal, Spring, Tween, Stagger, Cascade, CountUp, Pressable, Sticky]).toEqual(
      expect.arrayContaining([expect.any(Function)]),
    );
  });

  it('exposes the motion hooks on the root', () => {
    expect([MotionProvider, useTween, useInView, useScroll]).toEqual(expect.arrayContaining([expect.any(Function)]));
  });

  it('aliases motion names that collide with design tokens', () => {
    expect(typeof motionDuration).toBe('function');
    expect(duration).not.toBe(motionDuration);
    expect(SkeletonLoader).not.toBe(Skeleton);
  });

  it('exposes a11y + framer adapters on the root', () => {
    expect(REDUCED_MOTION_QUERY).toContain('prefers-reduced-motion');
    expect(typeof getPrefersReducedMotion).toBe('function');
    expect(typeof shouldAnimate).toBe('function');
    expect(typeof motionSafeStyle).toBe('function');
    expect(typeof collapseMotion).toBe('function');
    expect([easingToFramer, springToFramer, loopToFramer, transitionToFramer, presetToFramer]).toEqual(
      expect.arrayContaining([expect.any(Function)]),
    );
  });
});