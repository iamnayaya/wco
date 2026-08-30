import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { useControllableState } from '../../lib/hooks';

export interface TabBarItem {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Count chip rendered above the icon. */
  badge?: number;
  disabled?: boolean;
}

export interface TabBarProps {
  items: readonly TabBarItem[];
  value?: string;
  defaultValue?: string;
  /** Controlled selection callback. */
  onChange?: (value: string) => void;
  position?: 'top' | 'bottom';
  /** Scrollable when items overflow (keeps reach on narrow screens). */
  scrollable?: boolean;
  /** Accessible name for the navigation landmark. */
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
}

function barStyle(position: 'top' | 'bottom'): CSSProperties {
  const horizontal: CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    background: sem('bg'),
    borderBottom: position === 'top' ? `1px solid ${sem('border')}` : 'none',
    borderTop: position === 'bottom' ? `1px solid ${sem('border')}` : 'none',
    boxShadow: position === 'top' ? undefined : shadows.raised,
    zIndex: 920,
  };
  return position === 'top'
    ? { ...horizontal, position: 'sticky', top: 0 }
    : { ...horizontal, position: 'sticky', bottom: 0, paddingBottom: 'env(safe-area-inset-bottom)' };
}

function itemStyle(active: boolean): CSSProperties {
  const indicator = active
    ? { boxShadow: `inset 0 ${2}px 0 0 ${sem('primary')}` }
    : undefined;
  return {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: '8px 6px 6px',
    border: 'none',
    background: 'transparent',
    color: active ? sem('primary') : sem('textFaint'),
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    fontFamily: 'var(--font-inter, system-ui)',
    cursor: 'pointer',
    position: 'relative',
    transition: `color ${motion.fast}, background-color ${motion.fast}`,
    ...indicator,
  };
}

/**
 * TabBar â€” the mobile destination rail (top indicator or bottom safe-area
 * bar). Active item carries `aria-current="page"` and an animated indicator;
 * counts render as accessible chips (`aria-label="N notifications"`).
 */
export function TabBar({
  items,
  value,
  defaultValue,
  onChange,
  position = 'bottom',
  scrollable = false,
  ariaLabel,
  className,
  style,
}: TabBarProps) {
  const [current, setCurrent] = useControllableState<string>({
    value,
    defaultValue: defaultValue ?? items[0]?.value ?? '',
    onChange,
  });

  const bus = barStyle(position);
  if (scrollable) {
    bus.overflowX = 'auto';
    bus.overflowY = 'hidden';
    bus.scrollbarWidth = 'none';
  }

  return (
    <nav aria-label={ariaLabel} className={cn('wco-tab-bar', className)} style={bus}>
      {items.map((item) => {
        const active = item.value === current;
        return (
          <button
            key={item.value}
            type="button"
            disabled={item.disabled}
            aria-current={active ? 'page' : undefined}
            aria-label={item.badge ? `${item.label}, ${item.badge}` : item.label}
            onClick={() => setCurrent(item.value)}
            style={itemStyle(active)}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              {item.icon && <span style={{ display: 'inline-flex' }}>{item.icon}</span>}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    paddingInline: 4,
                    borderRadius: 999,
                    background: sem('dangerText'),
                    color: sem('textInverse'),
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: '16px',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}