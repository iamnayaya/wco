import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, focusRing, sem, type ControlSize } from '../lib/styles';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: ControlSize;
  /** Marks the control invalid (sets `aria-invalid` + tone). */
  error?: boolean;
  /** Leading adornment (icon, currency symbol, flag…). */
  prefix?: ReactNode;
  /** Trailing adornment. */
  suffix?: ReactNode;
  /** Hide native browser validation styling (keep our own, e.g. in forms). */
  noValidate?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    error = false,
    prefix,
    suffix,
    noValidate = false,
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
  const base: CSSProperties = {
    ...(prefix || suffix
      ? {}
      : { height: s.height }),
    minHeight: s.height,
    paddingInline: s.px,
    fontSize: s.fontSize,
    fontFamily: 'var(--font-inter, system-ui)',
    color: sem('text'),
    background: sem('surface'),
    border: `1px solid ${invalid ? sem('dangerText') : sem('borderStrong')}`,
    borderRadius: controlBorderRadius[size],
    boxShadow: invalid ? `0 0 0 3px ${sem('dangerBg')}` : undefined,
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
    ...style,
  };

  const inputEl = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      className={cn('wco-input', className)}
      style={{
        ...base,
        outline: 'none',
        background: 'transparent',
        color: 'inherit',
        border: 'none',
        width: '100%',
      }}
      {...props}
    />
  );

  if (!prefix && !suffix) return inputEl;

  return (
    <div
      className="wco-input-group"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: s.height,
        paddingInline: s.px,
        background: sem('surface'),
        border: `1px solid ${invalid ? sem('dangerText') : sem('borderStrong')}`,
        borderRadius: controlBorderRadius[size],
        boxShadow: invalid ? `0 0 0 3px ${sem('dangerBg')}` : undefined,
        transition: 'border-color 120ms ease',
      }}
    >
      {prefix && (
        <span className="wco-input-prefix" aria-hidden style={{ display: 'inline-flex', color: sem('textFaint'), fontSize: s.fontSize }}>
          {prefix}
        </span>
      )}
      {inputEl}
      {suffix && (
        <span className="wco-input-suffix" style={{ display: 'inline-flex', color: sem('textFaint'), fontSize: s.fontSize, flexShrink: 0 }}>
          {suffix}
        </span>
      )}
    </div>
  );
});