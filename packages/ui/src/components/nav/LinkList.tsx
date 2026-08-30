import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { Icon } from '../Icon';

export interface LinkListItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  href?: string;
  /** Opens in a new context with a trailing external glyph. */
  external?: boolean;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface LinkListProps {
  items: readonly LinkListItem[];
  /** Accessible name â€” renders a visible group heading when `heading` is set. */
  ariaLabel: string;
  /** Optional visible list heading. */
  heading?: string;
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
}

function rowStyle(size: 'sm' | 'md'): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingInline: 10,
    height: size === 'sm' ? 36 : 44,
    border: 'none',
    background: 'transparent',
    borderRadius: radii.md,
    fontSize: size === 'sm' ? 13 : 14,
    fontFamily: 'var(--font-inter, system-ui)',
    color: sem('text'),
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'start',
    textDecoration: 'none',
    transition: `background-color ${motion.fast}, color ${motion.fast}`,
  };
}

function accentStyle(active: boolean): CSSProperties | undefined {
  return active
    ? { boxShadow: `inset 3px 0 0 0 ${sem('primary')}` }
    : undefined;
}

/**
 * LinkList â€” an accessible navigation list (`aria-labelledby` heading,
 * `aria-current` on the active row). Rows render as real anchors when a
 * `href` is given and buttons otherwise, so navigation works without JS.
 */
export function LinkList({ items, ariaLabel, heading, size = 'md', className, style }: LinkListProps) {
  const listStyle: CSSProperties = {
    listStyle: 'none',
    margin: 0,
    padding: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    ...style,
  };

  return (
    <nav aria-label={ariaLabel} className={cn('wco-link-list', className)} style={{ width: '100%' }}>
      {heading && (
        <div
          style={{
            padding: '6px 12px 8px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: sem('textFaint'),
          }}
        >
          {heading}
        </div>
      )}
      <ul style={listStyle}>
        {items.map((item) => {
          const finalStyle: CSSProperties = {
            ...rowStyleBase(size, Boolean(item.active)),
            ...accentStyle(Boolean(item.active)),
            opacity: item.disabled ? 0.45 : 1,
            cursor: item.disabled ? 'default' : 'pointer',
          };
          const content = (
            <>
              {item.icon && <span aria-hidden style={{ display: 'inline-flex', flexShrink: 0, color: item.active ? sem('primary') : sem('textFaint') }}>{item.icon}</span>}
              {item.description ? (
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block' }}>{item.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: sem('textMuted') }}>{item.description}</span>
                </span>
              ) : (
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              )}
              {item.external && (
                <Icon name="external" size="sm" aria-hidden style={{ color: sem('textFaint') }} />
              )}
            </>
          );
          if (item.disabled) {
            return (
              <li key={item.id}>
                <span style={finalStyle}>{content}</span>
              </li>
            );
          }
          return (
            <li key={item.id}>
              {item.href ? (
                <a
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer noopener' : undefined}
                  onClick={item.onSelect}
                  style={finalStyle}
                >
                  {content}
                </a>
              ) : (
                <button
                  type="button"
                  aria-current={item.active ? 'page' : undefined}
                  onClick={item.onSelect}
                  style={finalStyle}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Base row styling for a given state. */
function rowStyleBase(size: 'sm' | 'md', active: boolean): CSSProperties {
  return {
    ...rowStyle(size),
    color: active ? sem('primary') : sem('text'),
    fontWeight: active ? 700 : 500,
    background: active ? sem('primarySoft') : 'transparent',
  };
}