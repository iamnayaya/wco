import { forwardRef, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, focusRing, sem, type ControlSize } from '../lib/styles';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
  error?: boolean;
  options?: SelectOption[];
  /** Accessible placeholder text (shown until a value is chosen). */
  placeholder?: string;
  leading?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', error = false, options = [], placeholder, leading, className, style, children, ...props },
  ref,
) {
  const s = controlSize[size];
  const invalid = error || props['aria-invalid'] === true;
  const base: CSSProperties = {
    width: '100%',
    height: s.height,
    paddingInlineStart: leading ? s.px : s.px,
    paddingInlineEnd: 40,
    fontSize: s.fontSize,
    fontFamily: 'var(--font-inter, system-ui)',
    color: sem('text'),
    background: sem('surface'),
    border: `1px solid ${invalid ? sem('dangerText') : sem('borderStrong')}`,
    borderRadius: controlBorderRadius[size],
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    transition: 'border-color 120ms ease',
    ...style,
  };

  return (
    <div style={{ display: 'block', position: 'relative', width: '100%' }}>
      {leading && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: s.px,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            color: sem('textFaint'),
            pointerEvents: 'none',
          }}
        >
          {leading}
        </span>
      )}
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn('wco-select', className)}
        style={base}
        {...props}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.length > 0
          ? options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))
          : children}
      </select>
    </div>
  );
});