import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface MessageBubbleProps {
  /** Which side of the thread this bubble belongs to. */
  side?: 'sent' | 'received';
  /** Delivery status (sent side only — renders the tick glyph). */
  status?: MessageStatus;
  children?: ReactNode;
  /** Timestamp string, rendered in the footer. */
  timestamp?: string;
  /** Reaction pills (e.g. "👍 1"). */
  reactions?: Array<{ emoji: string; count?: number }>;
  /** Renders the classic conversation tail toward the side's edge. */
  tail?: boolean;
  /** Highlight the bubble (e.g. search hit, active thread). */
  highlight?: boolean;
  className?: string;
  style?: CSSProperties;
}

const STATUS_TICK: Record<MessageStatus, string> = {
  sending: '🕐',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
};

/** WhatsApp-flavored message bubble, fully themed + accessible. */
export function MessageBubble({
  side = 'received',
  status = 'delivered',
  children,
  timestamp,
  reactions = [],
  tail = true,
  highlight = false,
  className,
  style,
}: MessageBubbleProps) {
  const sent = side === 'sent';
  const read = status === 'read';
  const bubble: CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    maxWidth: 'min(78%, 420px)',
    padding: '8px 12px',
    borderRadius: 14,
    borderBottomRightRadius: sent && tail ? 4 : 14,
    borderBottomLeftRadius: !sent && tail ? 4 : 14,
    background: sent ? sem('primary') : sem('surface'),
    color: sent ? sem('primaryFg') : sem('text'),
    fontSize: 14,
    lineHeight: 1.5,
    boxShadow: sent ? undefined : '0 1px 2px rgb(0 0 0 / 0.05)',
    border: sent ? 'none' : `1px solid ${sem('border')}`,
    outline: highlight ? `2px solid ${sem('ring')}` : undefined,
    ...style,
  };
  return (
    <div
      className={cn('wco-msg', className)}
      style={{ display: 'flex', justifyContent: sent ? 'flex-end' : 'flex-start', marginBlock: 4 }}
    >
      <div role="note" style={bubble}>
        {children}
        {(timestamp || status === 'sending') && (
          <span
            className="wco-msg-meta"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 4,
              marginTop: 4,
              fontSize: 10.5,
              lineHeight: 1,
              color: sent ? undefined : sem('textFaint'),
              opacity: sent ? 0.75 : 1,
            }}
          >
            {timestamp}
            {sent && (
              <span role="img" aria-label={status} title={status} className="wco-msg-status" style={{ fontStyle: 'italic', fontWeight: read ? 700 : 400 }}>
                {STATUS_TICK[status]}
              </span>
            )}
          </span>
        )}
        {reactions.length > 0 && (
          <span aria-hidden style={{ position: 'absolute', bottom: -10, left: sent ? undefined : 8, right: sent ? 8 : undefined, display: 'flex', gap: 4 }}>
            {reactions.map((r, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: sem('surface'),
                  border: `1px solid ${sem('border')}`,
                  borderRadius: 9999,
                  paddingInline: 5,
                  paddingBlock: 1,
                  lineHeight: 1.3,
                }}
              >
                {r.emoji}
                {r.count !== undefined ? ` ${r.count}` : ''}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}