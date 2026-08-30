import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { useControllableState } from '../../lib/hooks';
import { Icon } from '../Icon';

export type PanelVariant = 'default' | 'raised' | 'inset';

export interface PanelProps {
  title?: string;
  icon?: ReactNode;
  subtitle?: string;
  /** Header action slot (buttons, menu, badgeâ€¦). */
  headerAction?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional divider-separated footer row. */
  footer?: ReactNode;
  variant?: PanelVariant;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const VARIANTS: Record<PanelVariant, CSSProperties> = {
  default: { background: sem('surface'), border: `1px solid ${sem('border')}`, boxShadow: shadows.card },
  raised: { background: sem('bgRaised'), border: `1px solid ${sem('border')}`, boxShadow: shadows.raised },
  inset: { background: sem('bgSunken'), border: 'none', boxShadow: 'none' },
};

/**
 * Panel â€” the workhorse card-with-structure. Header (icon + title +
 * subtitle + actions), optional collapsible body, optional footer. Sits on
 * the `sem` surface scale so it inherits both themes automatically.
 */
export function Panel({
  title,
  icon,
  subtitle,
  headerAction,
  collapsible = false,
  defaultOpen = true,
  open,
  onOpenChange,
  footer,
  variant = 'default',
  children,
  className,
  style,
}: PanelProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const expanded = !collapsible || isOpen;

  return (
    <section
      className={cn('wco-panel', className)}
      style={{ borderRadius: radii.lg, overflow: 'hidden', ...VARIANTS[variant], ...style }}
    >
      {(title || icon || headerAction) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderBottom: expanded ? `1px solid ${sem('border')}` : 'none',
            minHeight: 52,
          }}
        >
          {collapsible ? (
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(!isOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'start',
              }}
            >
              {icon && <span aria-hidden style={{ color: sem('textFaint'), display: 'inline-flex' }}>{icon}</span>}
              <span style={{ minWidth: 0 }}>
                {title && (
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>{title}</span>
                )}
                {subtitle && <span style={{ display: 'block', fontSize: 12, color: sem('textMuted') }}>{subtitle}</span>}
              </span>
              <Icon name="chevronDown" aria-hidden style={{ marginLeft: 'auto', color: sem('textFaint'), transition: `transform ${motion.base}`, transform: isOpen ? undefined : 'rotate(-90deg)' }} />
            </button>
          ) : (
            <>
              {icon && <span aria-hidden style={{ color: sem('textFaint'), display: 'inline-flex' }}>{icon}</span>}
              <span style={{ flex: 1, minWidth: 0 }}>
                {title && (
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>{title}</span>
                )}
                {subtitle && <span style={{ display: 'block', fontSize: 12, color: sem('textMuted') }}>{subtitle}</span>}
              </span>
            </>
          )}
          {headerAction}
        </div>
      )}
      {expanded && (
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      )}
      {expanded && footer && (
        <div style={{ borderTop: `1px solid ${sem('border')}`, padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: sem('bgSunken') }}>
          {footer}
        </div>
      )}
    </section>
  );
}