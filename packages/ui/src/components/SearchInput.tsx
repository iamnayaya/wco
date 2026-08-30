import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, sem, type ControlSize } from '../lib/styles';

/**
 * SearchInput — a text input with a leading search icon and (optionally) a clear
 * button. `aria-label` is only required when it's the sole cue for the search.
 */
export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize;
  error?: boolean;
  /** Show a clear ('×') button when there's text. */
  clearable?: boolean;
  onClear?: () => void;
  searchIcon?: ReactNode;
  clearIcon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    size = 'md',
    error = false,
    clearable = true,
    onClear,
    searchIcon,
    clearIcon,
    className,
    style,
    disabled,
    value,
    onChange,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const s = controlSize[size];
  const invalid = error || ariaInvalid === true;
  const hasValue = value !== undefined ? String(value).length > 0 : false;

  const base: CSSProperties = {
    width: '100%',
    minHeight: s.height,
    paddingInlineStart: s.height + 4,
    paddingInlineEnd: clearable ? s.height + 4 : s.px,
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
    <div className={cn('wco-search', className)} style={{ position: 'relative', display: 'block', width: '100%' }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'inline-flex',
          color: sem('textFaint'),
          pointerEvents: 'none',
        }}
      >
        {searchIcon ?? (
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
        )}
      </span>
      <input
        ref={ref}
        type={props.type ?? 'search'}
        disabled={disabled}
        value={value}
        onChange={onChange}
        aria-invalid={invalid || undefined}
        style={base}
        role="searchbox"
        {...props}
      />
      {clearable && hasValue && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear search"
          onClick={(e) => {
            onClear?.();
            onChange?.({ target: { value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>);
          }}
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
            cursor: 'pointer',
            borderRadius: '50%',
          }}
        >
          {clearIcon ?? (
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
});
