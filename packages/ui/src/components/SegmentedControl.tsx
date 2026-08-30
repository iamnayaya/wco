import { useId, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, sem, type ControlSize } from '../lib/styles';

export interface Segment {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: Segment[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible group name (required). */
  label: string;
  size?: ControlSize;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Accessible segmented control — `role="radiogroup"` with keyboard
 * arrow-key navigation (WAI-ARIA radio pattern). Used for the WCO header
 * date-range/chart toggles.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  size = 'md',
  disabled = false,
  fullWidth = false,
  className,
  style,
}: SegmentedControlProps) {
  const groupId = useId();
  const s = controlSize[size];
  const activeIndex = options.findIndex((o) => o.value === value);

  const handleKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const idx = activeIndex;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % options.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + options.length) % options.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = options.length - 1;
    if (next !== null) {
      e.preventDefault();
      const candidate = options[next];
      if (!candidate.disabled) onChange(candidate.value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKey}
      className={cn('wco-segmented', className)}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        width: fullWidth ? '100%' : 'auto',
        padding: 2,
        gap: 2,
        borderRadius: controlBorderRadius.lg,
        background: sem('bgSunken'),
        ...style,
      }}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        const optDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={optDisabled || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => !optDisabled && onChange(opt.value)}
            disabled={optDisabled}
            aria-labelledby={`${groupId}-seg-${i}`}
            style={{
              flex: fullWidth ? 1 : undefined,
              height: s.height - 4,
              paddingInline: s.px,
              borderRadius: controlBorderRadius.md,
              fontSize: s.fontSize - 1,
              fontWeight: 600,
              fontFamily: 'var(--font-inter, system-ui)',
              color: selected ? sem('primaryFg') : sem('text'),
              background: selected ? sem('primary') : 'transparent',
              border: 'none',
              cursor: optDisabled ? 'not-allowed' : 'pointer',
              opacity: optDisabled ? 0.5 : 1,
              transition: 'background-color 120ms ease, color 120ms ease',
              outlineOffset: '2px',
            }}
            onFocus={(e) => {
              if (!selected) {
                e.currentTarget.style.boxShadow = `0 0 0 2px ${sem('ring')}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <span id={`${groupId}-seg-${i}`}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}