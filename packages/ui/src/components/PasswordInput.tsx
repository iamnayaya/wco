import { forwardRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, sem, type ControlSize } from '../lib/styles';
import { useControllableState } from '../lib/hooks';

/**
 * PasswordInput — a masked input with a show/hide toggle, plus a lightweight
 * strength meter and native `autoComplete` guidance for password managers.
 */
export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  size?: ControlSize;
  error?: boolean;
  /** Show the built-in password-strength hint bar (0–4 segments). */
  showStrength?: boolean;
  strength?: 0 | 1 | 2 | 3 | 4;
  /** Controlled visibility. Defaults to hidden. */
  revealed?: boolean;
  onRevealChange?: (revealed: boolean) => void;
  revealIcon?: (revealed: boolean) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Very lightweight password-strength estimator (length + class coverage). */
export function estimatePasswordStrength(value: string): 0 | 1 | 2 | 3 | 4 {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_COLOR = [
  sem('borderStrong'),
  sem('dangerText'),
  sem('warningText'),
  sem('accentStrong'),
  sem('successText'),
];

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  {
    size = 'md',
    error = false,
    showStrength = false,
    strength,
    revealed,
    onRevealChange,
    revealIcon,
    className,
    style,
    disabled,
    defaultValue,
    value,
    onChange,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const s = controlSize[size];
  const [visible, setVisible] = useControllableState<boolean>({
    value: revealed,
    defaultValue: false,
    onChange: onRevealChange,
  });
  const invalid = error || ariaInvalid === true;
  const strengthValue = useControllableState<0 | 1 | 2 | 3 | 4>({
    value: strength,
    defaultValue: 0,
  })[0] ?? estimatePasswordStrength(typeof value === 'string' ? value : '');

  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: s.height,
    paddingInlineStart: s.px,
    paddingInlineEnd: s.height + 8,
    fontSize: s.fontSize,
    fontFamily: 'var(--font-inter, system-ui)',
    color: sem('text'),
    background: sem('surface'),
    border: `1px solid ${invalid ? sem('dangerText') : sem('borderStrong')}`,
    borderRadius: controlBorderRadius[size],
    boxShadow: invalid ? `0 0 0 3px ${sem('dangerBg')}` : undefined,
    transition: 'border-color 120ms ease',
    ...style,
  };

  return (
    <div className={cn('wco-password', className)} style={{ position: 'relative', display: 'block', width: '100%' }}>
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        aria-invalid={invalid || undefined}
        autoComplete={props.autoComplete ?? 'current-password'}
        style={inputStyle}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
        disabled={disabled}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: s.height - 12,
          height: s.height - 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'transparent',
          color: sem('textFaint'),
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {revealIcon ? (
          revealIcon(visible)
        ) : (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {visible ? (
              <path d="M2 2l20 20M6.7 6.7A13 13 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5-1.3M9.9 4.2A9.9 9.9 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2.3 3.3" />
            ) : (
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
            )}
          </svg>
        )}
      </button>
      {showStrength && strengthValue > 0 && (
        <div
          aria-hidden
          role="progressbar"
          aria-valuenow={strengthValue}
          aria-valuemin={0}
          aria-valuemax={4}
          style={{ display: 'flex', gap: 4, marginTop: 6 }}
        >
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= strengthValue ? STRENGTH_COLOR[strengthValue] : sem('border'),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
