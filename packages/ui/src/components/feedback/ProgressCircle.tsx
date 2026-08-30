import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * ProgressCircle — an indeterminate or determinate circular progress ring,
 * used for uploads, sync, and stats. Screen-reader value via `role="progressbar"`.
 */
export interface ProgressCircleProps {
  value?: number;
  /** 0–100 when `value` is given; else indeterminate spinner. */
  max?: number;
  size?: number;
  strokeWidth?: number;
  /** Label announced to screen readers (required when determinate). */
  label?: string;
  className?: string;
  style?: CSSProperties;
  color?: string;
}

export function ProgressCircle({ value, max = 100, size = 40, strokeWidth = 4, label, className, style, color }: ProgressCircleProps) {
  const determinate = value !== undefined;
  const pct = determinate ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  const stroke = color ?? sem('primary');

  return (
    <div
      role="progressbar"
      aria-valuenow={determinate ? Math.round(pct) : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-valuetext={determinate ? `${Math.round(pct)}%` : undefined}
      className={cn('wco-progress-circle', className)}
      style={{ position: 'relative', width: size, height: size, ...style }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={sem('borderStrong')} strokeWidth={strokeWidth} />
        {determinate ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.25} ${circumference}`}
          >
            <animateTransform attributeName="transform" type="rotate" from={`0 ${size / 2} ${size / 2}`} to={`360 ${size / 2} ${size / 2}`} dur="1s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      {determinate && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.24,
            fontWeight: 600,
            color: sem('text'),
          }}
        >
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

export default ProgressCircle;
