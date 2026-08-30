import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { Avatar } from '../media/Avatar';
import { formatRelative } from '../../lib/format';
import type { Conversation } from './message-model';

/**
 * ChatList — the WhatsApp conversations sidebar: avatars, names, last-message
 * preview, timestamp, unread badge, and optional inline search. Keyboard
 * accessible (listbox semantics).
 */
export interface ChatListProps {
  conversations: Conversation[];
  selectedId?: string | number;
  onSelect?: (conversation: Conversation) => void;
  /** Renders the preview text (e.g. prefix with the sender's role). */
  renderPreview?: (c: Conversation) => ReactNode;
  searchable?: boolean;
  className?: string;
  style?: CSSProperties;
  empty?: ReactNode;
}

export function ChatList({ conversations, selectedId, onSelect, renderPreview, searchable = false, className, style, empty }: ChatListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => c.customerName.toLowerCase().includes(q) || c.phone.includes(q));
  }, [conversations, query]);

  return (
    <div className={cn('wco-chat-list', className)} style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {searchable && (
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${sem('border')}` }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            style={{
              width: '100%',
              height: 36,
              padding: '0 12px',
              border: `1px solid ${sem('borderStrong')}`,
              borderRadius: 999,
              outline: 'none',
              background: sem('bgSunken'),
              fontFamily: 'var(--font-inter, system-ui)',
              fontSize: 13,
              color: sem('text'),
            }}
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: sem('textFaint'), fontSize: 13 }}>{empty ?? 'No conversations'}</div>
      ) : (
        <ul role="listbox" aria-label="Conversations" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {filtered.map((c) => {
            const selected = c.id === selectedId;
            const preview = renderPreview ? renderPreview(c) : c.lastMessage;
            return (
              <li
                key={c.id}
                role="option"
                aria-selected={selected}
                onClick={() => onSelect?.(c)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  cursor: onSelect ? 'pointer' : 'default',
                  background: selected ? sem('surfaceHover') : 'transparent',
                  borderBottom: `1px solid ${sem('border')}`,
                }}
              >
                <Avatar name={c.customerName} src={c.customerAvatar} size={44} status={c.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: selected ? 700 : 600, fontSize: 14, color: sem('text'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.customerName}</span>
                    {c.lastTimestamp && <span style={{ fontSize: 11, color: sem('textFaint'), flexShrink: 0 }}>{formatRelative(new Date(c.lastTimestamp))}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 13, color: sem('textMuted'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview}</span>
                    {c.unread ? (
                      <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: sem('primary'), color: sem('primaryFg'), fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0 }}>
                        {c.unread}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ChatList;
