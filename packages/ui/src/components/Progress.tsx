import type { CSSProperties } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export interface ProgressProps {
  value?: number;
  /** Indeterminate (animated) bar. */
  indeterminate?: boolean;
  /** Accessible label shown alongside value. */
  label?: string;
  /** Show value text (e.g. "64%"). */
  showValue?: boolean;
  /** Bounds for accessible value text. */
  min?: number;
  max?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Accessible progress bar — `role="progressbar"` for determinate, `aria-busy`
 * for indeterminate. The track is fully theme-aware.
 */
export function Progress({
  value = 0,
  indeterminate = false,
  label,
  showValue = false,
  min = 0,
  max = 100,
  height = 8,
  className,
  style,
}: ProgressProps) {
  const bounded = Math.min(max, Math.max(min, value));
  const pct = max === min ? 0 : ((bounded - min) / (max - min)) * 100;
  const bar: CSSProperties = {
    position: 'relative',
    width: '100%',
    height,
    borderRadius: 9999,
    background: sem('bgSunken'),
    overflow: 'hidden',
    ...style,
  };
  return (
    <div className={cn('wco-progress', className)} aria-label={label}>
      <div
        role={indeterminate ? 'progressbar' : 'progressbar'}
        aria-label={label}
        aria-busy={indeterminate || undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : bounded}
        aria-valuetext={showValue ? `${pct}%` : undefined}
        style={bar}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            insetBlock: 0,
            left: 0,
            width: indeterminate ? '38%' : `${pct}%`,
            borderRadius: 9999,
            background: sem('primary'),
            transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            animation: indeterminate ? 'wco-progress-indeterminate 1.4s ease-in-out infinite' : undefined,
          }}
        />
      </div>
      {showValue && (
        <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: sem('textMuted'), fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </span>
      )}
    </div>
  );
}