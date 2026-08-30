import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { useControllableState } from '../../lib/hooks';

export interface BottomNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Highlight the item regardless of software state. */
  active?: boolean;
  /** Count chip (truncates to 99+). */
  badge?: number;
  onSelect?: () => void;
}

export interface BottomNavigationBarProps {
  items: readonly BottomNavItem[];
  /** Controlled active id. */
  current?: string;
  /** Where the active tab starts when uncontrolled. */
  defaultCurrent?: string;
  onChange?: (id: string) => void;
  /** Optional Material-style center "extended" slot (floating action). */
  extended?: ReactNode;
  /** Nav landmark accessible name. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

function badgeLabel(count: number, label: string): string {
  return count > 99 ? `${label}, 99+` : `${label}, ${count}`;
}

/**
 * BottomNavigationBar â€” 3â€“5 item mobile tab rail with an optional raised
 * center "extended" action (QR, scan, cameraâ€¦). Every tab is a real button,
 * active tabs get `aria-current="page"` + a filled indicator dot, and the
 * rail is sticky to the viewport bottom like native apps.
 */
export function BottomNavigationBar({
  items,
  current,
  defaultCurrent,
  onChange,
  extended,
  label = 'Navigation',
  className,
  style,
}: BottomNavigationBarProps) {
  const [activeId, setActiveId] = useControllableState<string>({
    value: current,
    defaultValue: defaultCurrent ?? items[0]?.id ?? '',
    onChange,
  });

  const renderItem = (item: BottomNavItem, isCompact: boolean) => {
    const active = item.active || item.id === activeId;
    return (
      <button
        key={item.id}
        type="button"
        aria-current={active ? 'page' : undefined}
        aria-label={item.badge ? badgeLabel(item.badge, item.label) : item.label}
        onClick={item.onSelect ?? (() => setActiveId(item.id))}
        style={{
          flex: isCompact ? 1 : undefined,
          width: isCompact ? undefined : 72,
          border: 'none',
          background: 'transparent',
          color: active ? sem('primary') : sem('textMuted'),
          cursor: 'pointer',
          padding: '6px 0',
          minHeight: 62,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          fontFamily: 'var(--font-inter, system-ui)',
          fontSize: 10.5,
          fontWeight: active ? 700 : 500,
          position: 'relative',
        }}
      >
        {item.badge ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 2,
              right: 'calc(50% - 18px)',
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: sem('dangerText'),
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '16px',
              textAlign: 'center',
            }}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        ) : null}
        <span aria-hidden style={{ display: 'inline-flex', color: 'inherit' }}>{item.icon}</span>
        <span
          style={{
            display: 'block',
            padding: '2px 8px',
            borderRadius: 999,
            background: active ? sem('primarySoft') : 'transparent',
            transition: `background-color ${motion.fast}`,
          }}
        >
          {item.label}
        </span>
        {active && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -1,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 22,
              height: 3,
              borderRadius: 999,
              background: sem('primary'),
            }}
          />
        )}
      </button>
    );
  };

  return (
    <nav
      aria-label={label}
      className={cn('wco-bottom-nav', className)}
      style={{
        position: 'sticky',
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: sem('surface'),
        borderTop: `1px solid ${sem('border')}`,
        boxShadow: shadows.raised,
        width: '100%',
        minHeight: 64,
        ...style,
      }}
    >
      {extended && items.length > 0 ? (
        <>
          {renderItem(items[0], true)}
          <span style={{ width: 72, position: 'relative', display: 'inline-flex', justifyContent: 'center' }}>
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: -28,
                transform: 'translateY(0)',
              }}
            >
              {extended}
            </span>
          </span>
          {items.slice(1).map((item) => renderItem(item, true))}
        </>
      ) : (
        items.map((item) => renderItem(item, false))
      )}
    </nav>
  );
}