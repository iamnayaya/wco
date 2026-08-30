import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export interface SliderMark {
  value: number;
  label?: ReactNode;
}

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number | [number, number];
  onChange: (value: number | [number, number]) => void;
  minMax?: { min: number; max: number };
  /** Marks rendered along the rail. */
  marks?: SliderMark[];
  /** Accessible name (required). */
  label: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function snap(v: number, step: number): number {
  return Math.round(v / step) * step;
}

/**
 * Accessible slider (`role="slider"`) supporting single and range values.
 * Arrow keys nudge by `step`; Home/End jump to bounds. Thumb is a visible,
 * focusable button so keyboard + pointer work identically.
 */
export function Slider({
  min: minProp,
  max: maxProp,
  step = 1,
  value,
  onChange,
  marks = [],
  label,
  disabled = false,
  className,
  style,
}: SliderProps) {
  const min = minProp ?? 0;
  const max = maxProp ?? 100;
  const isRange = Array.isArray(value);
  const lo = isRange ? value[0] : value;
  const hi = isRange ? value[1] : value;

  const pct = useMemo(() => {
    const p = (v: number) => ((v - min) / (max - min)) * 100;
    return isRange ? [p(lo), p(hi)] : [p(lo)];
  }, [lo, hi, min, max, isRange]);

  const handleKey = (e: React.KeyboardEvent, which: 'lo' | 'hi') => {
    if (disabled) return;
    e.preventDefault();
    const current = which === 'lo' ? lo : hi;
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
    if (delta === 0 || e.key === 'Home' || e.key === 'End') {
      const target = e.key === 'Home' ? min : e.key === 'End' ? max : null;
      if (target !== null) {
        if (isRange) {
          const nv: [number, number] = which === 'lo' ? [target, Math.max(target, hi)] : [Math.min(lo, target), target];
          onChange(nv);
        } else onChange(target);
      }
      return;
    }
    const next = clamp(snap(current + delta, step), min, max);
    if (isRange) {
      const nv: [number, number] = which === 'lo' ? [Math.min(next, hi), hi] : [lo, Math.max(next, lo)];
      onChange(nv);
    } else onChange(next);
  };

  const thumbProps = (which: 'lo' | 'hi') => ({
    role: 'slider' as const,
    'aria-label': label,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': which === 'lo' ? lo : hi,
    'aria-valuetext': which === 'lo' ? `Min ${lo}` : `Max ${hi}`,
    'aria-disabled': disabled || undefined,
    tabIndex: disabled ? -1 : 0,
    style: { cursor: disabled ? 'not-allowed' : 'grab', ...thumbBase },
    onKeyDown: (e: React.KeyboardEvent) => handleKey(e, which),
  });

  const thumbBase: CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: sem('surface'),
    border: `2px solid ${sem('primary')}`,
    boxShadow: '0 1px 3px rgb(0 0 0 / 0.25)',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    outlineOffset: '2px',
  };

  return (
    <div
      className={cn('wco-slider', className)}
      role="presentation"
      style={{ position: 'relative', height: 32, touchAction: 'none', ...style }}
    >
      {/* rail */}
      <span
        aria-hidden
        style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 4, transform: 'translateY(-50%)', background: sem('bgSunken'), borderRadius: 9999 }}
      />
      {/* filled track */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          height: 4,
          transform: 'translateY(-50%)',
          left: `${pct[0]}%`,
          width: `${(isRange ? pct[1] - pct[0] : pct[0])}%`,
          background: disabled ? sem('borderStrong') : sem('primary'),
          borderRadius: 9999,
        }}
      />
      {marks.map((m) => (
        <button
          type="button"
          key={m.value}
          aria-hidden
          tabIndex={-1}
          onClick={() => isRange ? onChange([Math.min(m.value, hi), Math.max(m.value, hi)]) : onChange(m.value)}
          style={{
            position: 'absolute',
            top: '50%',
            left: `${((m.value - min) / (max - min)) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: `2px solid ${sem('borderStrong')}`,
            background: sem('surface'),
            cursor: 'pointer',
          }}
        />
      ))}
      {/* thumbs */}
      {isRange ? (
        <>
          <span {...thumbProps('lo')} style={{ left: `${pct[0]}%`, ...thumbBase }} />
          <span {...thumbProps('hi')} style={{ left: `${pct[1]}%`, ...thumbBase }} />
        </>
      ) : (
        <span {...thumbProps('lo')} style={{ left: `${pct[0]}%`, ...thumbBase }} />
      )}
    </div>
  );
}