import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, focusRing, motion, sem, type ControlSize } from '../lib/styles';
import { Spinner } from './Spinner';

/** Visual variants. `primary` = Ember, `sun` = high-energy CTA, `neutral` = quiet. */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning'
  | 'sun'
  | 'neutral';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Control size. `md` (44px) is the touch-first default. */
  size?: ControlSize;
  /** Renders an inline spinner and disables interaction. */
  loading?: boolean;
  /** Accessible label shown next to the spinner while `loading`. */
  loadingText?: string;
  /** Expands to the available width of its container. */
  fullWidth?: boolean;
  /** Optional leading icon node. */
  icon?: ReactNode;
  /** Squared icon-only button; requires a non-empty `aria-label`/`title`. */
  iconOnly?: boolean;
  /** Disables hover/pressed affordances but keeps it focusable & readable. */
  quietDisabled?: boolean;
}

const VARIANTS: Record<ButtonVariant, { fg: string; bg: string }> = {
  primary: { fg: sem('primaryFg'), bg: sem('primary') },
  secondary: { fg: sem('secondaryFg'), bg: sem('secondary') },
  outline: { fg: sem('primary'), bg: 'transparent' },
  ghost: { fg: sem('textMuted'), bg: 'transparent' },
  danger: { fg: sem('textInverse'), bg: sem('dangerText') },
  success: { fg: sem('textInverse'), bg: sem('successText') },
  warning: { fg: 'var(--wco-accent-fg, #3a2a00)', bg: sem('accent') },
  sun: { fg: sem('accentFg'), bg: sem('accentStrong') },
  neutral: { fg: sem('text'), bg: sem('surfaceHover') },
};

/** Outlined & ghost variants need a border to read as buttons in both themes. */
const BORDERED: ReadonlySet<ButtonVariant> = new Set(['outline', 'secondary']);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText = 'Loading…',
    fullWidth = false,
    icon,
    iconOnly = false,
    quietDisabled = false,
    className,
    style,
    disabled,
    type = 'button',
    children,
    'aria-label': ariaLabel,
    ...props
  },
  ref,
) {
  const s = controlSize[size];
  const variantStyle = VARIANTS[variant];

  const styling: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    height: s.height,
    minWidth: iconOnly ? s.height : undefined,
    width: fullWidth ? '100%' : undefined,
    paddingInline: iconOnly ? 0 : s.px,
    paddingBlock: 0,
    borderRadius: controlBorderRadius[size],
    fontSize: s.fontSize,
    fontWeight: 600,
    fontFamily: 'var(--font-inter, system-ui)',
    color: variantStyle.fg,
    background: variantStyle.bg,
    border: BORDERED.has(variant) ? `1px solid ${sem('borderStrong')}` : 'none',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    transition: `background-color ${motion.fast}, color ${motion.fast}, border-color ${motion.fast}, transform 80ms ${motion.base}`,
    ...style,
  };

  const variantHover: Partial<Record<ButtonVariant, CSSProperties>> = {
    primary: { backgroundColor: sem('primaryHover') },
    secondary: { backgroundColor: sem('secondaryHover') },
    outline: { backgroundColor: sem('primarySoft'), color: sem('primary') },
    ghost: { backgroundColor: sem('surfaceHover'), color: sem('text') },
    danger: { opacity: 0.88 },
    success: { opacity: 0.88 },
    warning: { filter: 'brightness(1.04)' },
    sun: { filter: 'brightness(1.04)' },
    neutral: { backgroundColor: sem('surfaceActive') },
  };

  const composed: CSSProperties = {
    ...styling,
    ...variantHover[variant],
  };

  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      className={cn('wco-button', className)}
      onMouseDown={(e) => {
        if (isDisabled || quietDisabled) return;
        e.currentTarget.style.transform = 'scale(0.985)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = '';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
      }}
      onKeyDown={(e) => {
        if (isDisabled || quietDisabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.currentTarget.style.transform = 'scale(0.985)';
        }
      }}
      onKeyUp={(e) => {
        e.currentTarget.style.transform = '';
      }}
      onFocus={(e) => {
        Object.assign(e.currentTarget.style, focusRing);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = '';
        e.currentTarget.style.outlineOffset = '';
        props.onBlur?.(e);
      }}
      style={{ ...composed, ...style }}
      {...props}
    >
      {loading ? (
        <Spinner size={s.fontSize + 2} color="currentColor" aria-hidden />
      ) : (
        icon
      )}
      {iconOnly ? null : loading && loadingText ? (
        <span className="wco-button-label">{loadingText}</span>
      ) : (
        <span className="wco-button-label">{children}</span>
      )}
    </button>
  );
});