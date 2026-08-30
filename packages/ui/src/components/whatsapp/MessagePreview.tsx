import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { Avatar, type AvatarProps } from '../media/Avatar';
import { Icon } from '../Icon';

export interface MessagePreviewProps {
  contactName: string;
  message: string;
  time?: string;
  unread?: number;
  muted?: boolean;
  pinned?: boolean;
  /** "read" shows filled double-check, "sent" single — same glyph family. */
  state?: 'sent' | 'read';
  active?: boolean;
  avatar?: Omit<AvatarProps, 'name'>;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * MessagePreview — the row that powers chat history / search / pinned chats:
 * avatar, name, timestamp, live preview line, mute·pin / tick glyphs, unread
 * bubble. The whole row is a real button with a composed `aria-label`.
 */
export function MessagePreview({
  contactName,
  message,
  time,
  unread,
  muted = false,
  pinned = false,
  state,
  active = false,
  avatar,
  onClick,
  className,
  style,
}: MessagePreviewProps) {
  const label = `${contactName}. ${message}${time ? `. ${time}` : ''}${unread ? `. ${unread} unread` : ''}`;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn('wco-msg-preview', className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        border: 'none',
        background: active ? sem('surfaceHover') : 'transparent',
        color: 'inherit',
        textAlign: 'start',
        cursor: onClick ? 'pointer' : 'default',
        borderBottom: `1px solid ${sem('border')}`,
        fontFamily: 'var(--font-inter, system-ui)',
        ...style,
      }}
    >
      <Avatar name={contactName} size={46} {...avatar} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: active || unread ? 700 : 600, fontSize: 14, color: sem('text'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {contactName}
          </span>
          {time && <span style={{ fontSize: 11, color: unread ? sem('primary') : sem('textFaint'), flexShrink: 0 }}>{time}</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {state && (
            <Icon name={state === 'read' ? 'inboxRead' : 'check'} size="xs" aria-hidden style={{ color: state === 'read' ? undefined : sem('textMuted'), flexShrink: 0 }} />
          )}
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: unread ? 600 : 400,
              color: unread ? sem('text') : sem('textMuted'),
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {message}
          </span>
          {muted && <Icon name="bell" size="xs" aria-hidden style={{ color: sem('textFaint'), flexShrink: 0 }} />}
          {pinned && <Icon name="bookmark" size="xs" aria-hidden style={{ color: sem('textFaint'), flexShrink: 0 }} />}
          {unread ? (
            <span
              aria-hidden
              style={{
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: sem('primary'),
                color: sem('primaryFg'),
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                flexShrink: 0,
              }}
            >
              {unread}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}