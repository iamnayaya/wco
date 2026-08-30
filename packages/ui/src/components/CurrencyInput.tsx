import { forwardRef, type CSSProperties, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlSize, sem, type ControlSize } from '../lib/styles';
import { currencies, formatCurrency, parseLocalizedNumber } from '../lib/format';

/**
 * CurrencyInput — a money input with a currency prefix/suffix, locale-aware
 * formatting, and optional precision. Defaults to emerging-market-friendly
 * behavior (KSh, ₦, GH₵, R, etc. — see `lib/format.ts`).
 */
export interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange'> {
  size?: ControlSize;
  error?: boolean;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  currency?: string;
  locale?: string;
  /** Hide the currency symbol (e.g. when already shown by a label). */
  hideSymbol?: boolean;
  min?: number;
  max?: number;
  className?: string;
  style?: CSSProperties;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  {
    size = 'md',
    error = false,
    value,
    defaultValue = 0,
    onChange,
    currency = 'NGN',
    locale = 'en-NG',
    hideSymbol = false,
    min,
    max,
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
  const meta = currencies[currency.toUpperCase()];
  const showSymbol = !hideSymbol && !!meta;

  const handleChange = (raw: string) => {
    const parsed = parseLocalizedNumber(raw);
    if (Number.isNaN(parsed)) return;
    let v = parsed;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange?.(v);
  };

  const display = Number.isFinite(value ?? 0) ? formatCurrency(value ?? 0, { currency, locale }) : '';

  return (
    <div ref={ref as never} className={cn('wco-currency', className)} style={{ position: 'relative', display: 'block', width: '100%' }}>
      {showSymbol && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: s.px,
            top: '50%',
            transform: 'translateY(-50%)',
            color: sem('textFaint'),
            fontSize: s.fontSize,
            pointerEvents: 'none',
          }}
        >
          {meta!.symbol}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-label={props['aria-label'] ?? `Amount in ${currency}`}
        style={{
          width: '100%',
          minHeight: s.height,
          paddingInlineStart: showSymbol ? s.height + 2 : s.px,
          paddingInlineEnd: s.px,
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
    </div>
  );
});
