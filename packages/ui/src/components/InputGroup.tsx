import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, sem, type ControlSize } from '../lib/styles';

/**
 * InputGroup — a composite input with a leading addon, trailing addon, or both
 * (e.g. currency symbol + a submit button). Theme-aware like the primitives.
 */
export interface InputGroupProps {
  size?: ControlSize;
  /** Leading addon (icon, currency, country flag…). */
  prefix?: ReactNode;
  /** Trailing addon. */
  suffix?: ReactNode;
  /** Marks invalid (sets aria-invalid on the input). */
  error?: boolean;
  className?: string;
  style?: CSSProperties;
  /** When passed, renders the given element inside the group (e.g. <input/>). */
  children?: ReactNode;
  /** Convenience for rendering the native input when no `children` given. */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export const InputGroup = forwardRef<HTMLDivElement, InputGroupProps>(function InputGroup(
  { size = 'md', prefix, suffix, error = false, className, style, children, inputProps },
  ref,
) {
  const s = controlSize[size];
  const invalid = error || inputProps?.['aria-invalid'] === true;
  const borderColor = invalid ? sem('dangerText') : sem('borderStrong');

  const groupStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: sem('surface'),
    border: `1px solid ${borderColor}`,
    borderRadius: controlBorderRadius[size],
    boxShadow: invalid ? `0 0 0 3px ${sem('dangerBg')}` : undefined,
    transition: 'border-color 120ms ease',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div ref={ref} className={cn('wco-input-group', className)} style={groupStyle}>
      {prefix != null && (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            paddingInlineStart: s.px,
            paddingRight: 4,
            color: sem('textFaint'),
            fontSize: s.fontSize,
            whiteSpace: 'nowrap',
          }}
        >
          {prefix}
        </span>
      )}
      {children != null ? (
        children
      ) : (
        <input
          {...inputProps}
          aria-invalid={invalid || undefined}
          style={{
            width: '100%',
            minHeight: s.height,
            paddingInline: s.px,
            fontSize: s.fontSize,
            fontFamily: 'var(--font-inter, system-ui)',
            color: sem('text'),
            background: 'transparent',
            border: 'none',
            outline: 'none',
            ...inputProps?.style,
          }}
        />
      )}
      {suffix != null && (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            paddingLeft: 4,
            paddingInlineEnd: s.px,
            color: sem('textFaint'),
            fontSize: s.fontSize,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
});
