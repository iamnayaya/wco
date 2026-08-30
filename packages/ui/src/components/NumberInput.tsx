import { forwardRef, type CSSProperties, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlSize, sem, type ControlSize } from '../lib/styles';
import { useCounter } from '../lib/hooks';
import { formatNumber, parseLocalizedNumber } from '../lib/format';

/**
 * NumberInput — a stepped numeric input with − / + buttons, min/max/step,
 * precision, and optional thousands formatting. Use it for quantities,
 * percentages, or any numeric field without currency semantics.
 */
export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange'> {
  size?: ControlSize;
  error?: boolean;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal precision to display (defaults to step's decimals or 0). */
  precision?: number;
  /** Show thousands separators. */
  format?: boolean;
  locale?: string;
  /** Hide the built-in stepper buttons (e.g. inside a specifying wrapper). */
  hideStepper?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    size = 'md',
    error = false,
    value,
    defaultValue = 0,
    onChange,
    min,
    max,
    step = 1,
    precision,
    format: formatEnabled = false,
    locale = 'en-US',
    hideStepper = false,
    className,
    style,
    disabled,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const s = controlSize[size];
  const invalid = error || ariaInvalid === true;
  const { value: current, increment, decrement, set } = useCounter({
    value,
    defaultValue,
    min,
    max,
    step,
    onChange: (v) => onChange?.(v),
  });
  const decimals = precision ?? (Math.floor(step) !== step ? step.toString().split('.')[1]?.length ?? 0 : 0);

  const display = (n: number) => {
    if (!Number.isFinite(n)) return '';
    const fixed = n.toFixed(decimals);
    return formatEnabled ? formatNumber(Number(fixed), { locale, maximumFractionDigits: decimals }) : fixed;
  };

  const handleLocalChange = (raw: string) => {
    const parsed = parseLocalizedNumber(raw);
    if (!Number.isNaN(parsed)) set(parsed);
    else if (raw === '' || raw === '-') set(0);
  };

  const stepperBtn: CSSProperties = {
    width: s.height - 12,
    height: (s.height - 12) / 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: sem('textFaint'),
    cursor: disabled ? 'not-allowed' : 'pointer',
    lineHeight: 1,
  };

  return (
    <div className={cn('wco-number', className)} style={{ position: 'relative', display: 'block', width: '100%' }}>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={display(current)}
        onChange={(e) => handleLocalChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        style={{
          width: '100%',
          minHeight: s.height,
          paddingInlineStart: s.px,
          paddingInlineEnd: hideStepper ? s.px : s.height + 4,
          fontSize: s.fontSize,
          fontFamily: 'var(--font-inter, system-ui)',
          color: sem('text'),
          background: sem('surface'),
          border: `1px solid ${invalid ? sem('dangerText') : sem('borderStrong')}`,
          borderRadius: 10,
          boxShadow: invalid ? `0 0 0 3px ${sem('dangerBg')}` : undefined,
          outline: 'none',
          transition: 'border-color 120ms ease',
          ...style,
        }}
        {...props}
      />
      {!hideStepper && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <button type="button" tabIndex={-1} style={stepperBtn} disabled={disabled || (max !== undefined && current >= max)} onClick={increment} aria-label="Increase">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 15l7-7 7 7" /></svg>
          </button>
          <button type="button" tabIndex={-1} style={stepperBtn} disabled={disabled || (min !== undefined && current <= min)} onClick={decrement} aria-label="Decrease">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 9l7 7 7-7" /></svg>
          </button>
        </span>
      )}
    </div>
  );
});
