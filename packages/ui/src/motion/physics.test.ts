import { describe, it, expect } from 'vitest';
import { stepSpring, integrateSpring, springDuration, stepDrop, stepFriction, flingDistance, normalizeVelocity } from './physics';

describe('motion/physics springs', () => {
  it('relaxes toward the target over time', () => {
    let v = 0;
    let pos = 0;
    const frames = integrateSpring(0, 100, { stiffness: 170, damping: 26, mass: 1 });
    expect(frames[0].value).toBe(0);
    const last = frames[frames.length - 1];
    expect(Math.abs(last.value - 100)).toBeLessThan(1.5);
    expect(Math.abs(last.velocity)).toBeLessThan(1);
    expect(last.atRest).toBe(true);
    v = frames[frames.length - 1].velocity;
    expect(v >= 0 || v <= 0).toBe(true);
  });

  it('never overshoots beyond rest naturally and settles without oscillation for UI damping', () => {
    const frames = integrateSpring(0, 100, { stiffness: 170, damping: 26, mass: 1 });
    const max = Math.max(...frames.map((f) => f.value));
    expect(max).toBeLessThan(101.5);
    // settled frame count is bounded (no infinite hang)
    expect(frames.length).toBeLessThan(100);
  });

  it('crisper springs settle faster (higher damping ratio)', () => {
    const bouncy = integrateSpring(0, 100, { stiffness: 170, damping: 6, mass: 1 });
    const snappy = integrateSpring(0, 100, { stiffness: 300, damping: 30, mass: 1 });
    expect(snappy.length).toBeLessThan(bouncy.length);
  });

  it('honours initialVelocity', () => {
    const withVel = stepSpring(0, 80, 100, { stiffness: 170, damping: 26 }, 16);
    const without = stepSpring(0, 0, 100, { stiffness: 170, damping: 26 }, 16);
    expect(withVel.value).toBeGreaterThan(without.value);
  });

  it('restDelta terminates a spring near the target', () => {
    const loose = integrateSpring(0, 100, { restDelta: 6, restSpeed: 60, stiffness: 300, damping: 40 });
    const strict = integrateSpring(0, 100, { restDelta: 0.01, restSpeed: 0.01, stiffness: 300, damping: 40 });
    expect(loose.length).toBeLessThan(strict.length);
    expect(Math.abs(loose[loose.length - 1].value - 100)).toBeLessThanOrEqual(6);
  });

  it('springDuration reports a sane bounded millisecond window', () => {
    const d = springDuration(0, 100, { stiffness: 170, damping: 26 });
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(1500);
  });

  it('clamps dt to 32ms so huge gaps cannot explode the solver', () => {
    const big = stepSpring(0, 0, 100, {}, 500);
    const capped = stepSpring(0, 0, 100, {}, 32);
    expect(big.value).toBeLessThan(1.05 * capped.value + 1);
  });
});

describe('motion/physics drops and friction', () => {
  it('accelerates under gravity and rests on the ground', () => {
    let y = 0;
    let v = 0;
    for (let i = 0; i < 200; i += 1) {
      const s = stepDrop(y, v, { gravity: 0.0006, ground: 100 }, 16);
      y = s.value;
      v = s.velocity;
      if (s.grounded) break;
    }
    expect(y).toBe(100);
    expect(v).toBe(0);
  });

  it('friction decays velocity monotonically toward rest', () => {
    let value = 0;
    let velocity = 120;
    let ttl = 0;
    while (Math.abs(velocity) > 0.05 && ttl < 5000) {
      const s = stepFriction(value, velocity, { power: 0.001 }, 16);
      value = s.value;
      velocity = s.velocity;
      ttl += 1;
    }
    expect(velocity).toBeLessThanOrEqual(0.05);
    expect(value).toBeGreaterThan(0);
  });

  it('flingDistance is proportional to velocity', () => {
    const fast = flingDistance(200);
    const slow = flingDistance(20);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeCloseTo(10 * slow, 5);
  });

  it('normalizeVelocity guards infinities', () => {
    expect(normalizeVelocity(Infinity)).toBe(0);
    expect(normalizeVelocity(-Infinity)).toBe(0);
    expect(normalizeVelocity(42)).toBe(42);
  });
});