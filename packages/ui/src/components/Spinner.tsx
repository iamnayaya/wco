import type { CSSProperties } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export interface SpinnerProps {
  /** Diameter in px. Defaults to 20. */
  size?: number;
  /** Stroke/label color. Defaults to the primary token. */
  color?: string;
  /** Accessible label. Replaces the default `Loading`. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Accessible, theme-aware loading spinner (role="status"). */
export function Spinner({ size = 20, color, label = 'Loading', className, style }: SpinnerProps) {
  const stroke = color ?? sem('primary');
  return (
    <span
      role="status"
      aria-label={label}
      aria-live="polite"
      className={cn('wco-spinner', className)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{
          animation: 'wco-spin 700ms linear infinite',
          color: stroke,
        }}
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}