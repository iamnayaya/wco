import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  /** Sets the tri-state visual (needs ref to clear afterwards). */
  indeterminate?: boolean;
  size?: number;
}

/**
 * Accessible checkbox with visible tri-state support. The native input is
 * visually replaced (opacity-0) but remains the focus/click target, so
 * keyboard, screen-reader and form behavior stay native.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, size = 18, className, style, disabled, ...props },
  ref,
) {
  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const [focused, setFocused] = useState(false);

  const box: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 4,
    background: sem('surface'),
    border: `1px solid ${disabled ? sem('borderStrong') : sem('outline')}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 120ms ease, border-color 120ms ease',
    boxShadow: focused ? `0 0 0 2px ${sem('ring')}` : undefined,
  };

  return (
    <label
      className={cn('wco-checkbox', className)}
      style={{
        display: 'inline-flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <span
        className="wco-checkbox-input"
        style={{ position: 'relative', display: 'inline-flex', marginTop: 2 }}
      >
        <input
          ref={innerRef}
          type="checkbox"
          disabled={disabled}
          aria-label={typeof label === 'string' ? label : undefined}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'inherit', zIndex: 1 }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        <span aria-hidden style={box}>
          <svg
            viewBox="0 0 24 24"
            width={size - 6}
            height={size - 6}
            fill="none"
            stroke={sem('primaryFg')}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={props.checked ? 1 : 0}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span
            style={{
              width: size - 8,
              height: 2,
              background: sem('primaryFg'),
              opacity: indeterminate ? 1 : 0,
            }}
          />
        </span>
      </span>
      {(label || description) && (
        <span style={{ display: 'block' }}>
          {label && (
            <span className="wco-checkbox-label" style={{ display: 'block', fontSize: 14, fontWeight: 500, color: sem('text') }}>
              {label}
            </span>
          )}
          {description && (
            <span className="wco-checkbox-desc" style={{ display: 'block', marginTop: 2, fontSize: 12, color: sem('textFaint') }}>
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
});