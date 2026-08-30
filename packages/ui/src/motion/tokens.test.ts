import { describe, it, expect } from 'vitest';
import {
  PRINCIPLES,
  DURATIONS,
  EASINGS,
  SPRINGS,
  DISTANCES,
  PRESETS,
  resolvePreset,
  presetNames,
  duration,
  distance,
  spring,
  springSpec,
  isShakePreset,
  countsOf,
  loopOf,
} from './tokens';
import { resolveEasing, interpolate } from './core';

describe('motion/tokens principles & tables', () => {
  it('documents exactly 15 principles', () => {
    expect(PRINCIPLES).toHaveLength(15);
    const names = PRINCIPLES.map((p) => p.name);
    ['Purpose', 'Speed', 'Easing', 'Distance', 'Scale', 'Blur', 'Overlap', 'Stagger', 'Springs', 'Reduced Motion', 'Continuity', 'Desync', 'Feedback', 'Interruption', 'Accessibility'].forEach((n) =>
      expect(names).toContain(n),
    );
  });

  it('every principle has concrete rules to enforce', () => {
    for (const p of PRINCIPLES) expect(p.rules.length).toBeGreaterThanOrEqual(2);
  });

  it('durations stay within the 120–1200ms contract', () => {
    for (const d of DURATIONS) {
      expect(d.ms).toBeGreaterThanOrEqual(120);
      expect(d.ms).toBeLessThanOrEqual(1200);
    }
    expect(DURATIONS).toHaveLength(8);
  });

  it('easing table exposes the families used across the system', () => {
    const names = EASINGS.map((e) => e.name);
    ['linear', 'out', 'in', 'inOut', 'circ', 'back', 'anticipate', 'elastic', 'bounce'].forEach((n) => expect(names).toContain(n));
  });

  it('spring presets sit inside the philosophy envelope', () => {
    for (const s of Object.values(SPRINGS)) {
      expect(s.stiffness).toBeGreaterThanOrEqual(60);
      expect(s.stiffness).toBeLessThanOrEqual(400);
      expect(s.damping).toBeGreaterThanOrEqual(10);
      expect(s.mass ?? 1).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('distance tokens cover micro to hero', () => {
    expect(distance('micro')).toBe(8);
    expect(distance('medium')).toBe(48);
    expect(distance('hero')).toBe(240);
  });
});

describe('motion/tokens presets', () => {
  it('ships at least 50 distinct presets across every family', () => {
    expect(presetNames().length).toBeGreaterThanOrEqual(50);
  });

  it('every named group actually resolves', () => {
    for (const name of presetNames()) {
      const spec = resolvePreset(name);
      expect(spec).toBeTruthy();
      if (spec.ease) expect(typeof resolveEasing(spec.ease)).toBe('function');
    }
  });

  it('enter presets combine opacity + travel and settle (loop once)', () => {
    const fade = resolvePreset('fadeInUp');
    expect(fade.from?.opacity).toBe(0);
    expect((fade.from?.y ?? 0) || (fade.from?.x ?? 0)).not.toBe(0);
    expect(loopOf(fade)).toBe('once');
    expect(countsOf(fade)).toBe(1);
  });

  it('shared variants move on expected axes', () => {
    // slideLeft: enters from the right and travels left (from.x positive)
    expect(resolvePreset('slideLeft').from?.x).toBeGreaterThan(0);
    // slideRight: enters from the left and travels right (from.x negative)
    expect(resolvePreset('slideRight').from?.x).toBeLessThan(0);
    expect(resolvePreset('slideUp').from?.y).toBeGreaterThan(0);
    expect(resolvePreset('slideDown').from?.y).toBeLessThan(0);
  });

  it('spring-driven presets carry real spring specs', () => {
    const pop = resolvePreset('popIn');
    expect(pop.mode).toBe('spring');
    expect(pop.spring?.stiffness).toBeGreaterThan(0);
    const scale = resolvePreset('scaleIn');
    expect(scale.mode).toBe('spring');
    expect(scale.spring?.damping).toBeGreaterThan(0);
  });

  it('loop presets mirror or loop with a bounded rhythm', () => {
    const pulse = resolvePreset('pulse');
    expect(loopOf(pulse)).toBe('mirror');
    expect(resolvePreset('ring').loop).toBe('loop');
    expect(resolvePreset('breathe').duration).toBe(1600);
  });

  it('durations never exceed the attention ceiling for attention presets', () => {
    for (const n of ['pulse', 'wobble', 'tada', 'swing']) {
      expect(resolvePreset(n).duration).toBeLessThanOrEqual(1200);
    }
  });

  it('missing presets throw with a clear message', () => {
    expect(() => resolvePreset('definitely-not-a-preset')).toThrow(/unknown preset/);
  });

  it('resolved presets do not share mutable from/to objects', () => {
    const a = resolvePreset('fadeInUp');
    const b = resolvePreset('fadeInUp');
    expect(a.from).not.toBe(b.from);
  });

  it('shake family detection matches the dedicated shake presets only', () => {
    expect(isShakePreset('shake')).toBe(true);
    expect(isShakePreset('shakeX')).toBe(true);
    expect(isShakePreset('fadeIn')).toBe(false);
  });

  it('resolves durations and springs via helpers', () => {
    expect(duration('micro')).toBe(120);
    expect(duration('nope', 250)).toBe(250);
    expect(spring('snappy').stiffness).toBe(280);
    expect(spring('nope').stiffness).toBe(SPRINGS.default.stiffness);
    expect(springSpec({ stiffness: 500 }).damping).toBe(SPRINGS.default.damping);
  });

  it('preset easing runs land on target at t=1 for tween enter specs', () => {
    const fade = resolvePreset('fadeIn');
    if (fade.ease) {
      const fn = resolveEasing(fade.ease);
      expect(fn(1)).toBeGreaterThan(0.98);
      expect(interpolate(0, 1, 1, { ease: fade.ease })).toBeGreaterThan(0.98);
    }
  });
});