import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * List — an accessible list (`ol`/`ul`) with optional leading/leading-icon,
 * checkmark for completed items, and dividers.
 */
export interface ListItem {
  id: string | number;
  content: ReactNode;
  /** Leading visual (avatar, icon, index, checkmark). */
  leading?: ReactNode;
  /** True renders a checkmark automatically (completed state). */
  completed?: boolean;
  onClick?: () => void;
}

export interface ListProps {
  items: ListItem[];
  ordered?: boolean;
  /** Render a divider between rows. */
  dividers?: boolean;
  empty?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function List({ items, ordered = false, dividers = true, empty, className, style, ariaLabel }: ListProps) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag aria-label={ariaLabel} className={cn('wco-list', className)} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', ...style }}>      {items.length === 0 && empty != null && (
        <li style={{ padding: 16, textAlign: 'center', color: sem('textFaint'), fontSize: 13 }}>{empty}</li>
      )}
      {items.map((item, i) => (
        <li
          key={item.id}
          onClick={item.onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 4px',
            borderBottom: dividers && i < items.length - 1 ? `1px solid ${sem('border')}` : 'none',
            cursor: item.onClick ? 'pointer' : 'default',
          }}
        >
          {item.leading != null ? (
            <div style={{ flexShrink: 0, display: 'inline-flex' }}>{item.leading}</div>
          ) : (
            item.completed && (
              <div
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: sem('primary'),
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={sem('primaryFg')} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
            )
          )}
          <div style={{ flex: 1, color: sem('text'), fontSize: 14, textDecoration: item.completed ? 'line-through' : 'none', opacity: item.completed ? 0.6 : 1 }}>{item.content}</div>
        </li>
      ))}
    </Tag>
  );
}

export default List;
