import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { formatRelative } from '../../lib/format';
import { useConversationMessages, type Message, type MessageSender } from './message-model';

/**
 * MessageThread — a scrolling WhatsApp-style conversation view. Supports
 * date separators, per-sender alignment/color, timestamps, delivery status
 * (sent/delivered/read), and auto-scroll to the newest message. Feed it the
 * `Message[]` model from `message-model.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export { useConversationMessages, type Message, type MessageSender } from './message-model';

export interface MessageThreadProps {
  messages: Message[];
  aiEnabled?: boolean;
  onReply?: (message: Message) => void;
  className?: string;
  style?: CSSProperties;
  /** Auto-scroll to the bottom on new messages. */
  autoScroll?: boolean;
  empty?: ReactNode;
}

const SENDER_COLOR: Record<MessageSender, string> = {
  customer: '#e8f5e9',
  business: '#e3f2fd',
  system: '#f1f5f9',
};

const SENDER_TEXT: Record<MessageSender, string> = {
  customer: '#1f2937',
  business: '#1e3a8a',
  system: '#475569',
};

export function MessageThread({ messages, onReply, className, style, autoScroll = true, empty }: MessageThreadProps) {
  const botRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) botRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, autoScroll]);

  if (messages.length === 0) {
    return <div className={cn('wco-message-thread', className)} style={{ textAlign: 'center', color: sem('textFaint'), padding: 40, ...style }}>{empty ?? 'No messages yet'}</div>;
  }

  return (
    <div className={cn('wco-message-thread', className)} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, ...style }}>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showDateSep = !prev || !sameDay(prev.timestamp, m.timestamp);
        const showAvatarGap = !prev || prev.sender !== m.sender;
        return (
          <div key={m.id}>
            {showDateSep && (
              <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                <span style={{ fontSize: 11, color: sem('textFaint'), background: sem('bgSunken'), padding: '2px 10px', borderRadius: 999 }}>{formatRelative(new Date(m.timestamp))}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: m.sender === 'business' ? 'flex-end' : 'flex-start', marginTop: showAvatarGap ? 8 : 0 }}>
              <div
                role="listitem"
                style={{
                  maxWidth: '78%',
                  background: SENDER_COLOR[m.sender],
                  color: SENDER_TEXT[m.sender],
                  padding: '8px 12px',
                  borderRadius: 12,
                  borderBottomRightRadius: m.sender === 'business' ? 4 : 12,
                  borderBottomLeftRadius: m.sender === 'business' ? 12 : 4,
                  position: 'relative',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
                }}
              >
                {onReply ? (
                  <button type="button" onClick={() => onReply(m)} style={{ border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, display: 'block', width: '100%', padding: 0 }}>
                    {m.body}
                  </button>
                ) : (
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{m.body}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2, fontSize: 10, opacity: 0.55 }}>
                  <span>{formatRelative(new Date(m.timestamp))}</span>
                  {m.status && (
                    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label={m.status}>
                      <path d="M18 7l-8 8-4-4" />
                      {m.status === 'delivered' || m.status === 'read' ? <path d="M22 7l-8 8-1-1" /> : null}
                      {m.status === 'read' ? <path d="M14 7l-1 1" /> : null}
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={botRef} />
    </div>
  );
}

function sameDay(a: number | string, b: number | string): boolean {
  const da = new Date(a).toDateString();
  const db = new Date(b).toDateString();
  return da === db;
}

export default MessageThread;
