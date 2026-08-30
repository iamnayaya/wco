import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { useControllableState } from '../../lib/hooks';
import { Icon } from '../Icon';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface SidebarGroup {
  id: string;
  label?: string;
  items: readonly SidebarItem[];
}

export interface SidebarProps {
  groups: readonly SidebarGroup[];
  /** Optional header slot above the groups (logo, workspace switcherâ€¦). */
  header?: ReactNode;
  footer?: ReactNode;
  width?: number;
  collapsedWidth?: number;
  /** Default `false`; labels collapse to icon rail. */
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  /** Accessible name for the navigation landmark. */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

function itemStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 40,
    paddingInline: 12,
    border: 'none',
    background: active ? sem('primarySoft') : 'transparent',
    color: active ? sem('primary') : sem('textMuted'),
    fontWeight: active ? 600 : 500,
    fontFamily: 'var(--font-inter, system-ui)',
    fontSize: 14,
    borderRadius: radii.md,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    position: 'relative',
    transition: `background-color ${motion.fast}, color ${motion.fast}`,
  };
}

/**
 * Sidebar â€” the app's persistent navigation rail. Collapses from a labeled
 * group tree to an icon-only rail with tooltips; the toggle reports
 * `aria-expanded` and items mark the active page with `aria-current`.
 */
export function Sidebar({
  groups,
  header,
  footer,
  width = 260,
  collapsedWidth = 68,
  defaultCollapsed = false,
  collapsed,
  onCollapseChange,
  ariaLabel = 'Sidebar',
  className,
  style,
}: SidebarProps) {
  const [isCollapsed, setCollapsed] = useControllableState<boolean>({
    value: collapsed,
    defaultValue: defaultCollapsed,
    onChange: onCollapseChange,
  });

  const rail: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: isCollapsed ? collapsedWidth : width,
    height: '100%',
    boxSizing: 'border-box',
    background: sem('bgRaised'),
    borderRight: `1px solid ${sem('border')}`,
    padding: '12px',
    transition: `width ${motion.base}, opacity ${motion.base}`,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...style,
  };

  return (
    <div className={cn('wco-sidebar', className)} style={rail} aria-label={ariaLabel} role="complementary">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32, marginBottom: 8, marginRight: 2 }}>
        {header}
        <button
          type="button"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          onClick={() => setCollapsed(!isCollapsed)}
          style={{
            border: 'none',
            background: 'transparent',
            color: sem('textFaint'),
            cursor: 'pointer',
            display: 'inline-flex',
            padding: 4,
            marginLeft: 'auto',
          }}
        >
          <Icon name={isCollapsed ? 'chevronRight' : 'chevronLeft'} size="sm" aria-hidden />
        </button>
      </div>
      <nav aria-label={ariaLabel} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {groups.map((group) => (
          <div key={group.id}>
            {group.label && !isCollapsed && (
              <div
                style={{
                  padding: '4px 12px 6px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: sem('textFaint'),
                }}
              >
                {group.label}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={isCollapsed ? item.label : undefined}
                  aria-label={isCollapsed ? item.label : undefined}
                  aria-current={item.active ? 'page' : undefined}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                  style={itemStyle(Boolean(item.active))}
                >
                  <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0 }}>{item.icon}</span>
                  {!isCollapsed && (
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                  )}
                  {!isCollapsed && item.badge && <span style={{ flexShrink: 0 }}>{item.badge}</span>}
                  {isCollapsed && item.badge && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: 8,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: sem('accentStrong'),
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div style={{ marginTop: 'auto', borderTop: `1px solid ${sem('border')}`, paddingTop: 10 }}>{footer}</div>}
    </div>
  );
}