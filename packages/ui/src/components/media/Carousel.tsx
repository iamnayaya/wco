import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { useInterval } from '../../lib/hooks';
import { useWcoI18n } from '../../lib/i18n';
import { Icon } from '../Icon';

export interface CarouselSlide {
  id: string;
  content: ReactNode;
}

export interface CarouselProps {
  slides: readonly CarouselSlide[];
  /** Accessible name for the carousel region. */
  label: string;
  showArrows?: boolean;
  showDots?: boolean;
  /** Whether the deck advances automatically (interval > 0). */
  autoPlay?: boolean;
  /** Autoplay interval in ms. */
  interval?: number;
  loop?: boolean;
  height?: number;
  onSlideChange?: (index: number) => void;
  className?: string;
  style?: CSSProperties;
}

function arrowStyle(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: side === 'left' ? 10 : undefined,
    right: side === 'right' ? 10 : undefined,
    border: 'none',
    background: sem('surface'),
    color: sem('text'),
    width: 36,
    height: 36,
    borderRadius: '50%',
    boxShadow: '0 2px 8px rgb(0 0 0 / 0.18)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function dotStyle(active: boolean): CSSProperties {
  return {
    width: active ? 20 : 8,
    height: 8,
    borderRadius: 999,
    border: 'none',
    background: active ? sem('primary') : sem('borderStrong'),
    cursor: 'pointer',
    padding: 0,
    transition: `width ${motion.fast}, background-color ${motion.fast}`,
  };
}

/**
 * Carousel â€” an accessible, dependency-free slide deck. `aria-live`
 * announcements, arrow-key navigation (RTL-aware), optional autoplay that
 * pauses on hover, and dots that report `aria-current`. Slides slide via
 * translateX transforms only (60fps, reduced-motion safe).
 */
export function Carousel({
  slides,
  label,
  showArrows = true,
  showDots = true,
  autoPlay = false,
  interval = 4000,
  loop = true,
  height,
  onSlideChange,
  className,
  style,
}: CarouselProps) {
  const { dir, t } = useWcoI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;
  const rtl = dir === 'rtl';
  const sign = rtl ? 1 : -1;

  const go = (next: number) => {
    if (total === 0) return;
    const clamped = loop ? (next + total) % total : Math.min(Math.max(next, 0), total - 1);
    setIndex(clamped);
    onSlideChange?.(clamped);
  };
  const step = (dir2: 1 | -1) => go(index + dir2 * (rtl ? -1 : 1));

  useInterval(
    () => {
      if (autoPlay) step(1);
    },
    autoPlay && !paused && interval > 0 ? interval : null,
  );

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          step(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          step(1);
        }
      }}
      className={cn('wco-carousel', className)}
      style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: radii.lg, ...style }}
    >
      <div style={{ display: 'flex', height: height ?? 'auto' }} aria-live={autoPlay ? 'off' : 'polite'} aria-atomic="true">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden={i !== index}
            style={{
              flex: '0 0 100%',
              width: '100%',
              transform: `translateX(${sign * (i - index) * 100}%)`,
              transition: `transform ${motion.base}`,
            }}
          >
            {slide.content}
          </div>
        ))}
      </div>
      <span
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0, padding: 0, margin: -1 }}
      >
        Slide {index + 1} of {total}
      </span>
      {showArrows && total > 1 && (
        <>
          <button
            type="button"
            aria-label={t.previous}
            disabled={!loop && index === 0}
            onClick={() => step(-1)}
            style={arrowStyle('left')}
          >
            <Icon name="chevronLeft" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t.next}
            disabled={!loop && index === total - 1}
            onClick={() => step(1)}
            style={arrowStyle('right')}
          >
            <Icon name="chevronRight" aria-hidden />
          </button>
        </>
      )}
      {showDots && total > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`${t.select} slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
              style={dotStyle(i === index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}