import { describe, expect, it } from 'vitest';
import { easingToFramer, loopToFramer, presetToFramer, springToFramer, transitionToFramer } from './framer';

describe('motion/framer adapter', () => {
  it('maps WCO easings onto Framer names and beziers', () => {
    expect(easingToFramer('linear')).toBe('linear');
    expect(easingToFramer('out')).toBe('easeOut');
    expect(easingToFramer('inOut')).toBe('easeInOut');
    expect(easingToFramer('circOut')).toBe('circOut');
    expect(easingToFramer('elasticOut')).toEqual([0.16, 1, 0.3, 1]);
    expect(easingToFramer([0.5, 0, 0.5, 1])).toEqual([0.5, 0, 0.5, 1]);
    const fn = (t: number) => t;
    expect(easingToFramer(fn)).toBe(fn);
  });

  it('converts spring params to a Framer spring transition', () => {
    expect(springToFramer({ stiffness: 200, damping: 30 })).toEqual({
      type: 'spring',
      stiffness: 200,
      damping: 30,
      mass: 1,
    });
    expect(springToFramer({ restDelta: 0.05 })).toMatchObject({ restDelta: 0.05, stiffness: 170 });
  });

  it('maps loop choreography onto Framer repeat/count semantics', () => {
    expect(loopToFramer('loop', 3)).toEqual({ repeat: 2, repeatType: 'loop' });
    expect(loopToFramer('mirror', 3)).toEqual({ repeat: 2, repeatType: 'mirror' });
    expect(loopToFramer('mirror', 0)).toEqual({ repeat: Infinity, repeatType: 'mirror' });
    expect(loopToFramer('loop', 1)).toBeUndefined();
    expect(loopToFramer('none')).toBeUndefined();
    expect(loopToFramer('once')).toBeUndefined();
  });

  it('builds a tween transition from a preset spec', () => {
    expect(transitionToFramer({ mode: 'tween', duration: 120, ease: 'out', delay: 10 })).toEqual({
      type: 'tween',
      duration: 120,
      delay: 10,
      ease: 'easeOut',
    });
    const springy = transitionToFramer({ mode: 'spring', spring: { stiffness: 90, damping: 12 } });
    expect(springy).toMatchObject({ type: 'spring', stiffness: 90, damping: 12, mass: 1 });
  });

  it('derives Framer variants from a registered preset', () => {
    const { hidden, visible, transition } = presetToFramer('fadeIn');
    expect(hidden).toEqual({ opacity: 0 });
    expect(visible).toEqual({ opacity: 1 });
    expect(transition).toMatchObject({ type: 'tween', duration: 320, ease: 'easeOut' });
  });

  it('derives Framer variants from a raw spec', () => {
    const { hidden, transition } = presetToFramer({ mode: 'spring', from: { scale: 1 }, to: { scale: 1.06 } });
    expect(hidden).toEqual({ scale: 1 });
    expect(transition.type).toBe('spring');
  });

  it('throws on unknown preset names', () => {
    expect(() => presetToFramer('does-not-exist')).toThrow();
  });
});