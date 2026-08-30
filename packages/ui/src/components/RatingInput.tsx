import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';
import { useControllableState, useId } from '../lib/hooks';

/**
 * RatingInput — a star/icon rating with hover preview, half steps, and full
 * keyboard + screen-reader support (radio-group semantics).
 */
export interface RatingInputProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  max?: number;
  /** Allow half-steps (e.g. 2.5). */
  allowHalf?: boolean;
  /** Allow clearing back to 0. */
  clearable?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: number;
  icon?: (on: boolean, half: boolean) => React.ReactNode;
  label?: string;
  /** Human labels for each rank, e.g. ['Poor','Good','Excellent']. */
  descriptions?: string[];
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

export const RatingInput = (props: RatingInputProps) => {
  const {
    value,
    defaultValue = 0,
    onChange,
    max = 5,
    allowHalf = false,
    clearable = true,
    disabled = false,
    readOnly = false,
    size = 24,
    icon,
    label = 'Rating',
    descriptions,
    className,
    style,
    'aria-label': ariaLabel = label,
  } = props;

  const [internal, setInternal] = useControllableState<number>({ value, defaultValue, onChange });
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();
  const interactive = !disabled && !readOnly;
  const active = hover ?? internal;

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    let next = internal;
    if (e.key === 'ArrowRight') next = Math.min(max, internal + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, internal - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    setInternal(next);
  };

  const pick = (val: number) => {
    if (!interactive) return;
    if (clearable && val === internal) setInternal(0);
    else setInternal(val);
  };

  return (
    <div
      className={cn('wco-rating', className)}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKey}
      onMouseLeave={() => setHover(null)}
      style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: 2, ...style }}
    >
      {Array.from({ length: max }).map((_, idx) => {
        const pos = idx + 1;
        const isOn = active >= pos;
        const isHalf = allowHalf && active >= pos - 0.5 && active < pos;
        return (
          <span key={pos} role="radio" aria-checked={internal === pos || (internal === pos - 0.5 && isHalf)} aria-label={descriptions?.[idx] ?? `${pos} of ${max}`} tabIndex={interactive && internal <= pos - 1 ? 0 : -1} onMouseEnter={() => interactive && setHover(pos)} onClick={() => pick(pos)} onFocus={() => interactive && setHover(pos)} style={{ display: 'inline-flex', cursor: interactive ? 'pointer' : 'default' }}>
            {icon ? (
              icon(isOn, isHalf)
            ) : (
              <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden style={{ transition: 'transform 100ms ease' }}>
                <path
                  d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9L12 2.5z"
                  fill={isOn ? sem('accent') : isHalf ? `url(#grad-${uid})` : 'transparent'}
                  stroke={isOn ? sem('accent') : sem('borderStrong')}
                  strokeWidth={1.5}
                />
                {isHalf && (
                  <defs>
                    <linearGradient id={`grad-${uid}`}>
                      <stop offset="50%" stopColor={sem('accent')} />
                      <stop offset="50%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                )}
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
};
