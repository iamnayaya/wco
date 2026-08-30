import { useRef, type CSSProperties, type PointerEvent, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';
import { useControllableState } from '../lib/hooks';

/**
 * RangeSlider — a single-thumb slider (or dual-handle range) with pointer,
 * keyboard (arrows/Home/End), and aria semantics. Dependency-free drag via
 * Pointer Events.
 */
export interface RangeSliderProps {
  value?: number | [number, number];
  defaultValue?: number | [number, number];
  onChange?: (value: number | [number, number]) => void;
  /** Two thumbs when true (returns [min,max]). */
  range?: boolean;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export const RangeSlider = (props: RangeSliderProps) => {
  const {
    value,
    defaultValue,
    onChange,
    range = false,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    label = 'Range',
    className,
    style,
  } = props;

  const isRange = range && Array.isArray(defaultValue);
  const [v, setV] = useControllableState<number | [number, number]>({
    value,
    defaultValue: (defaultValue ?? (isRange ? [min, max] : min)) as number | [number, number],
    onChange,
  });
  const lo = isRange ? (v as [number, number])[0] : (v as number);
  const hi = isRange ? (v as [number, number])[1] : lo;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'lo' | 'hi' | null>(null);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const snap = (n: number) => clamp(Math.round((n - min) / step) * step + min);

  const normalizeValue = (nextLo: number, nextHi: number): number | [number, number] => {
    if (!isRange) return nextLo;
    const l = Math.min(nextLo, nextHi);
    const h = Math.max(nextLo, nextHi);
    return [l, h];
  };

  const pxToVal = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return min;
    const ratio = (clientX - rect.left) / rect.width;
    return snap(min + ratio * (max - min));
  };

  const startDrag = (which: 'lo' | 'hi') => (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    dragging.current = which;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || disabled) return;
    const nv = pxToVal(e.clientX);
    const values = isRange ? (v as [number, number]) : [lo, hi];
    if (dragging.current === 'lo') setV(normalizeValue(nv, values[1]));
    else setV(normalizeValue(values[0], nv));
  };

  const stopDrag = () => {
    dragging.current = null;
  };

  const onKey = (which: 'lo' | 'hi') => (e: KeyboardEvent<HTMLDivElement>) => {
    const values = isRange ? (v as [number, number]) : [lo, hi];
    const cur = which === 'lo' ? values[0] : values[1];
    let next: number | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp(cur + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp(cur - step);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next === undefined) return;
    e.preventDefault();
    setV(which === 'lo' ? normalizeValue(next, values[1]) : normalizeValue(values[0], next));
  };

  const width = ((hi - lo) / (max - min)) * 100;
  const loPct = ((lo - min) / (max - min)) * 100;
  const hiPct = ((hi - min) / (max - min)) * 100;

  const thumbStyle = (pct: number): CSSProperties => ({
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    left: `${pct}%`,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: sem('surface'),
    border: `2px solid ${sem('primary')}`,
    cursor: disabled ? 'not-allowed' : 'grab',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    touchAction: 'none',
  });

  return (
    <div className={cn('wco-range', className)} style={{ position: 'relative', width: '100%', padding: '9px 0', ...style }}>
      <div
        ref={trackRef}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={isRange ? lo : (v as number)}
        aria-valuetext={isRange ? `${lo} to ${hi}` : undefined}
        aria-orientation="horizontal"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
        style={{
          position: 'relative',
          height: 6,
          borderRadius: 999,
          background: sem('borderStrong'),
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${loPct}%`,
            width: `${width}%`,
            height: '100%',
            borderRadius: 999,
            background: sem('primary'),
          }}
        />
        <div role="presentation" onPointerDown={startDrag('lo')} onKeyDown={onKey('lo')} tabIndex={disabled ? -1 : 0} style={thumbStyle(loPct)} />
        {isRange && (
          <div role="presentation" onPointerDown={startDrag('hi')} onKeyDown={onKey('hi')} tabIndex={disabled ? -1 : 0} style={thumbStyle(hiPct)} />
        )}
      </div>
    </div>
  );
};
