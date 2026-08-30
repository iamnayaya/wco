import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { Badge, type BadgeProps } from '../Badge';

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  /** Tone chip shown under the title. */
  badge?: BadgeProps;
  /** Footer slot (avatars, due date, priorityâ€¦). */
  footer?: ReactNode;
  onClick?: () => void;
}

export interface KanbanColumn {
  id: string;
  title: string;
  /** Icon rendered in the column header. */
  icon?: ReactNode;
  cards: readonly KanbanCard[];
  /** Action slot (add, menuâ€¦). */
  action?: ReactNode;
}

export interface KanbanProps {
  columns: readonly KanbanColumn[];
  /** Accessible name for the board. */
  ariaLabel: string;
  columnsWidth?: number;
  className?: string;
  style?: CSSProperties;
}

const CARD: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: `1px solid ${sem('border')}`,
  borderRadius: radii.md,
  background: sem('surface'),
  textAlign: 'start',
  fontFamily: 'var(--font-inter, system-ui)',
  color: sem('text'),
  cursor: 'pointer',
  transition: `border-color ${motion.fast}, box-shadow ${motion.fast}, transform ${motion.fast}`,
};

/**
 * Kanban â€” a horizontal, scrollable board of columns. Column headers carry
 * a live count chip; every card is a real button with its own `onClick`
 * (optional), and the layout degrades gracefully to stacked sections on
 * narrow viewports (scroll on desktop, wrap on mobile).
 */
export function Kanban({ columns, ariaLabel, columnsWidth = 280, className, style }: KanbanProps) {
  const board: CSSProperties = {
    display: 'flex',
    gap: 14,
    overflowX: 'auto',
    paddingBottom: 8,
    alignItems: 'flex-start',
    ...style,
  };

  return (
    <div
      role="list"
      aria-label={ariaLabel}
      className={cn('wco-kanban', className)}
      style={board}
    >
      {columns.map((column) => (
        <section
          key={column.id}
          role="listitem"
          aria-label={column.title}
          style={{
            flex: '0 0 auto',
            width: columnsWidth,
            maxWidth: '86vw',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: sem('bgSunken'),
            borderRadius: radii.lg,
            padding: 10,
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
            }}
          >
            {column.icon && <span aria-hidden style={{ color: sem('textFaint'), display: 'inline-flex' }}>{column.icon}</span>}
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-inter, system-ui)', color: sem('text'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {column.title}
            </span>
            <Badge count={column.cards.length} size="sm" />
            {column.action}
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {column.cards.length === 0 ? (
              <div
                aria-hidden
                style={{ padding: '16px 10px', textAlign: 'center', fontSize: 13, color: sem('textFaint'), border: `1px dashed ${sem('borderStrong')}`, borderRadius: radii.md }}
              >
                Empty
              </div>
            ) : (
              column.cards.map((card) => (
                <button key={card.id} type="button" onClick={card.onClick} style={CARD}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>{card.title}</span>
                  {card.description && (
                    <span style={{ display: 'block', marginTop: 4, fontSize: 12.5, lineHeight: 1.4, color: sem('textMuted') }}>{card.description}</span>
                  )}
                  {(card.badge || card.footer) && (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
                      {card.badge ? <Badge {...card.badge} size="sm" /> : <span />}
                      {card.footer && <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{card.footer}</span>}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}