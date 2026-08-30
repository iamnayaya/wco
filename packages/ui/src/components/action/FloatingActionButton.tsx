import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii, shadows } from '../../design-tokens/layout';
import { useControllableState, useKey } from '../../lib/hooks';
import { Icon } from '../Icon';

export interface FloatingActionItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect?: () => void;
}

export type FabVariant = 'primary' | 'secondary' | 'danger' | 'sun';

const FAB_VARIANTS: Record<FabVariant, { bg: string; fg: string }> = {
  primary: { bg: sem('primary'), fg: sem('primaryFg') },
  secondary: { bg: sem('secondary'), fg: sem('secondaryFg') },
  danger: { bg: sem('dangerText'), fg: sem('textInverse') },
  sun: { bg: sem('accentStrong'), fg: sem('accentFg') },
};

export interface FloatingActionButtonProps {
  /** Accessible name (also shown as the empty-state tooltip). */
  label: string;
  /** Main icon; defaults to a `+`. Rotates open when the dial expands. */
  icon?: ReactNode;
  /** When provided the FAB becomes a speed dial that fans its actions. */
  items?: readonly FloatingActionItem[];
  variant?: FabVariant;
  /** Single-action callback (ignored when `items` is set). */
  onPress?: () => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * FloatingActionButton — single-action FAB or a speed-dial that fans
 * labeled actions upward with a dismiss-on-scrim, Escape-to-close, ARIA
 * `aria-expanded` wiring and reduced-motion-aware transitions.
 */
export function FloatingActionButton({
  label,
  icon,
  items,
  variant = 'primary',
  onPress,
  open,
  defaultOpen,
  onOpenChange,
  className,
  style,
}: FloatingActionButtonProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen ?? false,
    onChange: onOpenChange,
  });
  const palette = FAB_VARIANTS[variant];
  const dial = Boolean(items?.length);
  const toggle = () => setOpen(!isOpen);
  const close = () => setOpen(false);

  useKey('Escape', close);

  const fabCore: CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    background: palette.bg,
    color: palette.fg,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: shadows.raised,
    transition: `transform 80ms ${motion.base}, background-color ${motion.fast}`,
  };

  return (
    <div
      className={cn('wco-fab', className)}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 950,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
        ...style,
      }}
      dir="ltr"
    >
      {isOpen && <div aria-hidden onClick={close} style={{ position: 'fixed', inset: 0 }} />}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        {items?.map((item) => {
          const openState: CSSProperties = isOpen
            ? { opacity: 1, transform: 'translateY(0)', visibility: 'visible' }
            : { opacity: 0, transform: 'translateY(10px)', visibility: 'hidden', pointerEvents: 'none' };
          return (
            <span
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: `opacity ${motion.base}, transform ${motion.base}, visibility ${motion.base}`,
                ...openState,
              }}
            >
              <span
                style={{
                  background: sem('surface'),
                  color: sem('text'),
                  border: `1px solid ${sem('border')}`,
                  borderRadius: radii.sm,
                  boxShadow: shadows.card,
                  padding: '4px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>
              <button
                type="button"
                tabIndex={isOpen ? 0 : -1}
                disabled={item.disabled}
                aria-label={item.label}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                style={{ ...fabCore, width: 44, height: 44 }}
              >
                {item.icon}
              </button>
            </span>
          );
        })}
      </div>
      <button
        type="button"
        aria-label={label}
        aria-haspopup={dial ? 'menu' : undefined}
        aria-expanded={dial ? isOpen : undefined}
        onClick={dialogActions(dial, toggle, onPress)}
        style={fabCore}
      >
        {icon ? (
          icon
        ) : (
          <Icon
            name="plus"
            aria-hidden
            style={{
              transition: `transform ${motion.base}`,
              transform: dial && isOpen ? 'rotate(45deg)' : undefined,
            }}
          />
        )}
      </button>
    </div>
  );
}

function dialogActions(dial: boolean, toggle: () => void, onPress?: () => void) {
  return dial ? toggle : () => onPress?.();
}