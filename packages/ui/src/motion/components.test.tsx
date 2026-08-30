import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Animate,
  Cascade,
  CountUp,
  Fade,
  Flip,
  Pressable,
  Reveal,
  Ripple,
  Rotate,
  ScrollProgressBar,
  ScrollToTop,
  Shake,
  Slide,
  Skeleton,
  Spring,
  Stagger,
  Sticky,
  Timeline,
  Tween,
  Zoom,
  MotionProvider,
} from './components';
import { __resetFrames, __setManualFrames, __tickFrame } from './raf';

/* ------------------------------- test utils ------------------------------ */

function boot(): void {
  __setManualFrames(true);
}
afterEach(() => __resetFrames());
beforeEach(() => boot());

/** Parse the y translate from buildTransform's output string. */
function yOf(el: HTMLElement): number {
  const m = el.style.transform.match(/translate3d\(\d*\.?\d*px,\s*(-?\d*\.?\d*)px/);
  return m ? Number.parseFloat(m[1]) : NaN;
}
function xOf(el: HTMLElement): number {
  const m = el.style.transform.match(/translate3d\((-?\d*\.?\d*)px/);
  return m ? Number.parseFloat(m[1]) : NaN;
}
function scaleOf(el: HTMLElement): number {
  const m = el.style.transform.match(/scale\(([\d.]+),/);
  return m ? Number.parseFloat(m[1]) : 1;
}
function hostOf(container: HTMLElement, text: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll('div')).find((d) => d.textContent === text);
}

const progress = async (time: number) => {
  await act(async () => {
    __tickFrame(time);
  });
};

/* --------------------------------- Animate ------------------------------- */

describe('motion/components Animate & entries', () => {
  it('Fade starts hidden and fades to full visibility', async () => {
    const { container } = render(<Fade duration={320}>hello</Fade>);
    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.opacity).toBe('0');
    await progress(2000);
    await progress(2100); // +100ms → mid-fade
    const mid = Number.parseFloat(el.style.opacity);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    await progress(2600); // complete
    expect(el.style.opacity).toBe('1');
  });

  it('Fade honours show/exit two-state control', async () => {
    const { container, rerender } = render(<Fade duration={100} show={false}>x</Fade>);
    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.opacity).toBe('1');
    rerender(<Fade duration={100} show> x </Fade>);
    act(() => undefined);
    await progress(3000);
    await progress(3100); // +100ms → entering
    expect(Number.parseFloat(el.style.opacity)).toBeGreaterThan(0);
    await progress(3300);
    expect(el.style.opacity).toBe('1');
  });

  it('Slide translates in from the chosen direction', async () => {
    const { container } = render(<Slide duration={100} direction="up" distance={24}>x</Slide>);
    const el = container.querySelector('div') as HTMLElement;
    expect(yOf(el)).toBe(24);
    await progress(4000);
    await progress(4200);
    expect(yOf(el)).toBe(0);
  });

  it('Zoom springs to the rest state', async () => {
    const { container } = render(<Zoom duration={100} mode="spring">x</Zoom>);
    const el = container.querySelector('div') as HTMLElement;
    expect(el.style.opacity).toBe('0');
    for (let i = 0; i < 200; i += 1) await progress(5000 + i * 16);
    expect(el.style.opacity).toBe('1');
    expect(scaleOf(el)).toBeCloseTo(1, 2);
  });

  it('Flip and Rotate project their entrance planes', () => {
    const a = render(<Flip axis="x">x</Flip>);
    const ra = a.container.querySelector('div') as HTMLElement;
    expect(ra.style.transform).toContain('rotateX(96deg)');
    const b = render(<Rotate fromDeg={-120}>y</Rotate>);
    const rb = b.container.querySelector('div') as HTMLElement;
    expect(rb.style.transform).toContain('rotate(-120deg)');
  });

  it('fires onAnimationEnd once the tween completes', async () => {
    const onEnd = vi.fn();
    render(<Animate duration={100} preset="fadeIn" onAnimationEnd={onEnd}>x</Animate>);
    await progress(6000);
    await progress(6100);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('Completes instantly under reduced motion (never mid-fade)', async () => {
    const { container } = render(
      <MotionProvider reduced>
        <Fade duration={1000}>x</Fade>
      </MotionProvider>,
    );
    const el = container.querySelector('div') as HTMLElement;
    await progress(7000);
    expect(el.style.opacity).toBe('1');
  });
});

/* ------------------------------ reveal family ---------------------------- */

describe('motion/components scroll reveals', () => {
  it('Reveal animates in when in view (no IO → visible)', async () => {
    const { container } = render(<Reveal duration={100} direction="up" distance={24}>peek</Reveal>);
    const el = hostOf(container, 'peek') as HTMLElement;
    for (let i = 0; i < 160; i += 1) await progress(8000 + i * 16);
    expect(el.style.opacity).toBe('1');
    expect(yOf(el)).toBe(0);
  });

  it('Stagger fans children one-by-one then settles all', async () => {
    const { container } = render(
      <Stagger interval={60} distance={24} duration={100}>
        <span>a</span><span>b</span><span>c</span>
      </Stagger>,
    );
    await progress(10000);
    await progress(10100); // +100ms: a mid, b just started (< its 60ms delay?), c waiting
    const a = hostOf(container, 'a') as HTMLElement;
    const c = hostOf(container, 'c') as HTMLElement;
    expect(Number.parseFloat(a.style.opacity)).toBeGreaterThan(0);
    expect(Number.parseFloat(c.style.opacity)).toBeLessThan(1);
    for (let i = 0; i < 120; i += 1) await progress(10200 + i * 16);
    expect((a as HTMLElement).style.opacity).toBe('1');
    expect((hostOf(container, 'b') as HTMLElement).style.opacity).toBe('1');
    expect((c as HTMLElement).style.opacity).toBe('1');
  });

  it('Stagger skips delays under forced reduced motion', async () => {
    const { container } = render(
      <MotionProvider reduced>
        <Stagger interval={60}>
          <span>a</span><span>b</span>
        </Stagger>
      </MotionProvider>,
    );
    await progress(12000);
    const a = hostOf(container, 'a') as HTMLElement;
    const b = hostOf(container, 'b') as HTMLElement;
    expect(a.style.opacity).toBe('1');
    expect(b.style.opacity).toBe('1');
  });

  it('Cascade reveals the group then staggers each item', async () => {
    const { container } = render(
      <Cascade interval={60} duration={80}>
        <span>c1</span><span>c2</span>
      </Cascade>,
    );
    await progress(14000); // warm-up (first frame dt 0)
    await progress(14080); // first real frame at +duration
    const c1 = hostOf(container, 'c1') as HTMLElement;
    const c2 = hostOf(container, 'c2') as HTMLElement;
    expect(Number.parseFloat(c1.style.opacity)).toBeGreaterThan(0);
    expect(Number.parseFloat(c2.style.opacity)).toBeLessThan(1);
    for (let i = 0; i < 120; i += 1) await progress(14200 + i * 16);
    expect(c1.style.opacity).toBe('1');
    expect(c2.style.opacity).toBe('1');
  });
});

/* ------------------------------ value hosts ------------------------------ */

describe('motion/components numeric hosts', () => {
  it('Tween renders the interpolated value as a function of children', async () => {
    const { container } = render(
      <Tween to={100} from={0} duration={100}>
        {(v) => <span data-testid="v">{v.toFixed(0)}</span>}
      </Tween>,
    );
    const span = container.querySelector('[data-testid="v"]');
    expect(span?.textContent).toBe('0');
    await progress(16000);
    await progress(16150); // +150ms > 100ms duration
    expect(span?.textContent).toBe('100');
  });

  it('Timeline splines through keyframes on the React clock', async () => {
    const { container } = render(
      <Timeline duration={100} points={[{ at: 0, value: 0, ease: 'linear' }, { at: 1, value: 10, ease: 'linear' }]}>
        {(v) => <span data-testid="tv">{v.toFixed(0)}</span>}
      </Timeline>,
    );
    const span = container.querySelector('[data-testid="tv"]');
    await progress(18000);
    await progress(18050); // +50ms → 5
    expect(span?.textContent).toBe('5');
    await progress(18150); // → 10
    expect(span?.textContent).toBe('10');
  });

  it('CountUp counts from 0 to the target', async () => {
    const { container } = render(<CountUp to={1000} duration={100} format={(n) => `$${Math.round(n)}`} data-testid="count" />);
    const span = container.querySelector('[data-testid="count"]');
    expect(span?.textContent).toBe('$0');
    await progress(20000);
    await progress(20100); // +100ms → done
    expect(span?.textContent).toBe('$1000');
  });

  it('Spring settles on the target state', async () => {
    const { container } = render(
      <Spring from={{ opacity: 1 }} to={{ opacity: 0.5 }}>
        <span>s</span>
      </Spring>,
    );
    const el = container.querySelector('div') as HTMLElement;
    for (let i = 0; i < 200; i += 1) await progress(22000 + i * 16);
    expect(el.style.opacity).toBe('0.5');
  });
});

/* ------------------------------- interactive ----------------------------- */

describe('motion/components gesture-affordances', () => {
  it('Ripple spawns on pointer down and cleans itself up', async () => {
    const { container } = render(
      <Ripple size={48} duration={100}>
        <span>tap me</span>
      </Ripple>,
    );
    const host = container.querySelector('span') as HTMLElement;
    await act(async () => {
      fireEvent.pointerDown(host, { clientX: 10, clientY: 12, pointerId: 1 });
    });
    expect(container.querySelector('[data-ripple]')).not.toBeNull();
    await progress(24000);
    await progress(24150);
    expect(container.querySelector('[data-ripple]')).toBeNull();
  });

  it('Pressable reports pressed state and scales down on press', async () => {
    const { container } = render(<Pressable duration={100} mode="spring">btn</Pressable>);
    const btn = container.querySelector('button') as HTMLElement;
    expect(btn.getAttribute('role')).toBe('button');
    await act(async () => {
      fireEvent.pointerDown(btn, { pointerId: 1, clientX: 0, clientY: 0 });
    });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    await progress(26000); // warm-up (first frame dt 0)
    await progress(26160); // first real frame: spring underway
    expect(scaleOf(btn)).toBeLessThan(1);
    await act(async () => {
      fireEvent.pointerUp(btn, { pointerId: 1, clientX: 0, clientY: 0 });
    });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('Shake shakes and returns to centre', async () => {
    const { container, rerender } = render(
      <Shake trigger={0} duration={400}>
        <span>shake</span>
      </Shake>,
    );
    const el = container.querySelector('div') as HTMLElement;
    rerender(<Shake trigger={1} duration={400}><span>shake</span></Shake>);
    await progress(28000);
    await progress(28100); // mid
    const mid = xOf(el);
    expect(mid).not.toBe(0);
    for (let i = 0; i < 100; i += 1) await progress(28200 + i * 16);
    expect(xOf(el)).toBe(0);
  });
});

/* -------------------------- scroll-affordances --------------------------- */

describe('motion/components scroll affordances', () => {
  it('ScrollProgressBar reflects window progress through aria', async () => {
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true });
    const { container } = render(<ScrollProgressBar />);
    const bar = container.querySelector('[role="progressbar"]') as HTMLElement;
    await progress(30000);
    const now = Number.parseInt(bar.getAttribute('aria-valuenow') ?? '0', 10);
    expect(now).toBeGreaterThan(0);
    expect(window.scrollY).toBe(500);
  });

  it('ScrollToTop appears only once scrolled past the threshold', async () => {
    Object.defineProperty(window, 'scrollY', { value: 30, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true });
    const { container } = render(<ScrollToTop threshold={50} duration={80} />);
    const wrapper = container.querySelector('span') as HTMLElement;
    await progress(32000);
    await progress(32100);
    expect(Number.parseFloat(wrapper.style.opacity)).toBeLessThan(1);
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true });
    await progress(32200);
    await progress(32400);
    expect(wrapper.style.opacity).toBe('1');
  });

  it('Sticky reflects clamping through data-stuck', async () => {
    const { container } = render(<Sticky top={40} />);
    const host = container.querySelector('div') as HTMLElement;
    host.getBoundingClientRect = () => ({ top: 60, bottom: 260, height: 200, left: 0, right: 400, width: 400, x: 0, y: 60, toJSON: () => ({}) }) as DOMRect;
    await progress(34000); // warm-up
    await progress(34100); // real frame: top 60 > 40 → not stuck
    expect(host.getAttribute('data-stuck')).toBe(null);
    host.getBoundingClientRect = () => ({ top: 30, bottom: 230, height: 200, left: 0, right: 400, width: 400, x: 0, y: 30, toJSON: () => ({}) }) as DOMRect;
    await progress(34200); // real frame: top 30 <= 40 → stuck
    await progress(34300);
    expect(host.getAttribute('data-stuck')).toBe('true');
  });
});

/* --------------------------------- extras -------------------------------- */

describe('motion/components extras', () => {
  it('Skeleton renders an accessible status region', () => {
    const { container } = render(<Skeleton lines={2} variant="shimmer" />);
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region?.querySelectorAll('[style]').length).toBeGreaterThan(0);
  });

  it('Animate renders arbitrary `as` elements with children', () => {
    const { container } = render(<Animate as="section" duration={50}><span>as-child</span></Animate>);
    expect(container.querySelector('section')).not.toBeNull();
    expect(container.textContent).toContain('as-child');
  });
});