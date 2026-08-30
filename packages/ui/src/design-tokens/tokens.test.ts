import { describe, it, expect } from 'vitest';
import { layoutSystem, gridFor, breakpoints } from '../design-tokens/layout-system';
import { icons, isIconName } from '../design-tokens/icons';
import { easings, durations, reducedMotion } from '../design-tokens/animation';
import { gradients, glass, dynamic, culturalRamp } from '../design-tokens/effects';
import { accessibility } from '../design-tokens/accessibility';

describe('layout-system', () => {
  it('defines the five canonical breakpoints in ascending order', () => {
    const vals = Object.values(breakpoints);
    const sorted = [...vals].sort((a, b) => a - b);
    expect(vals).toEqual(sorted);
    expect(Object.keys(breakpoints)).toEqual(['sm', 'md', 'lg', 'xl', '2xl']);
  });

  it('gridFor returns an 8-column grid at a tablet width and 12 at desktop', () => {
    expect(gridFor(900).columns).toBe(8);
    expect(gridFor(1100).columns).toBe(12);
    expect(gridFor(2000).columns).toBe(16);
    expect(gridFor(360).columns).toBe(4);
  });

  it('exposes mobile-first media-query strings', () => {
    expect(layoutSystem.media.md).toBe(`(min-width: ${breakpoints.md}px)`);
  });
});

describe('icons', () => {
  it('exposes a canonical size scale with 24 as the UI default', () => {
    expect(icons.sizes.md).toBe(24);
    expect(Object.keys(icons.sizes).length).toBeGreaterThanOrEqual(5);
  });

  it('recognizes known icon names and rejects unknown ones', () => {
    expect(isIconName('chat')).toBe(true);
    expect(isIconName('inboxRead')).toBe(true);
    expect(isIconName('definitelyNotAnIcon')).toBe(false);
  });

  it('exposes the de-duplicated vocabulary with no duplicates', () => {
    const set = new Set(icons.names);
    expect(set.size).toBe(icons.names.length);
    expect(icons.names.length).toBeGreaterThan(80);
  });
});

describe('animation', () => {
  it('keeps every easing a valid cubic-bezier or linear token', () => {
    const values = Object.values(easings);
    expect(values.every((v) => v === 'linear' || /^cubic-bezier\(/.test(v))).toBe(true);
    expect(Object.keys(easings).length).toBeGreaterThanOrEqual(10);
  });

  it('keeps all durations within a sane 0–1s budget', () => {
    const parse = (v: string) => (v.endsWith('ms') ? Number(v.slice(0, -2)) : Number(v) * 1000);
    expect(Object.values(durations).every((v) => parse(v) <= 1000)).toBe(true);
  });

  it('reduced-motion collapses expressive durations to near-zero', () => {
    expect(reducedMotion.durations.fast).toBe('0.01ms');
    expect(reducedMotion.durations.deliberate).toBe('0.01ms');
  });
});

describe('effects', () => {
  it('defines branded gradients, glass primitives, and time-of-day ambience', () => {
    expect(gradients.brandWash).toContain('linear-gradient');
    expect(glass.card.backdropFilter).toBeDefined();
    expect(dynamic.timeOfDay.day.accent).toBeDefined();
  });

  it('defines a cultural ramp per target market with an accessible accent', () => {
    for (const key of ['nigeria', 'ghana', 'kenya', 'southAfrica'] as const) {
      expect(culturalRamp[key].accent).toBeTruthy();
    }
  });
});

describe('accessibility', () => {
  it('promises AAA contrast for body + muted text', () => {
    expect(accessibility.contrast.body).toMatch(/7\.0/);
    expect(accessibility.contrast.bodyMuted).toMatch(/7\.0/);
  });

  it('mandates the 44px touch target', () => {
    expect(accessibility.touch.minTarget).toBe(44);
    expect(accessibility.touch.spacing).toBe(8);
  });

  it('exposes an actionable PR checklist', () => {
    expect(accessibility.checklist.length).toBeGreaterThanOrEqual(8);
  });
});
