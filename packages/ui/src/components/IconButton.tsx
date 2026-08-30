import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, sem, type ControlSize } from '../lib/styles';

export type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant. */
  variant?: IconButtonVariant;
  /** Square control size. */
  size?: ControlSize;
  /** Loading state (spinner replaces the icon). */
  loading?: boolean;
  /** Accessible name. REQUIRED — renders as `aria-label` for screen readers. */
  label: string;
  /** Optional tooltip text shown on hover/focus (title). */
  title?: string;
  icon: ReactNode;
}

const VARIANTS: Record<IconButtonVariant, CSSProperties> = {
  primary: { color: sem('primaryFg'), background: sem('primary') },
  secondary: {
    color: sem('secondaryFg'),
    background: sem('secondary'),
  },
  ghost: { color: sem('textMuted'), background: 'transparent' },
  danger: { color: sem('textInverse'), background: sem('dangerText') },
};

const HOVER: Record<IconButtonVariant, CSSProperties> = {
  primary: { background: sem('primaryHover') },
  secondary: { background: sem('secondaryHover') },
  ghost: { background: sem('surfaceHover'), color: sem('text') },
  danger: { opacity: 0.88 },
};

/**
 * Icon-only button with a mandatory accessible label.
 * (See `MessageBubble`/`StatCard` for usage; visually it is the square form of
 * `Button` with `iconOnly`.)
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', loading = false, label, title, icon, className, style, disabled, type = 'button', ...props },
  ref,
) {
  const s = controlSize[size];
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: s.height,
    height: s.height,
    borderRadius: controlBorderRadius[size],
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color 120ms ease, color 120ms ease, opacity 120ms ease',
    ...VARIANTS[variant],
    ...style,
  };
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={label}
      aria-busy={loading || undefined}
      title={title ?? label}
      className={cn('wco-icon-button', className)}
      style={base}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          role="status"
          aria-label="Loading"
          style={{
            width: s.fontSize + 2,
            height: s.fontSize + 2,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'wco-spin 700ms linear infinite',
          }}
        />
      ) : (
        icon
      )}
    </button>
  );
});

/** Export for consumers that need coordinated hover feedback. */
export const iconButtonHover = HOVER;