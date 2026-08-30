import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { Avatar, type AvatarProps } from '../media/Avatar';
import { Icon } from '../Icon';

export interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  /** Avatar is optional; pass `src`/`status` to customize. */
  avatar?: Omit<AvatarProps, 'name'>;
  /** Renders a back/close affordance (real button). */
  onBack?: () => void;
  /** Trailing action slot (call, video, menu…). */
  actions?: ReactNode;
  /** Accessible label for the back button. */
  backLabel?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * ChatHeader — the WhatsApp thread header: optional back, avatar with
 * presence dot, name + subtitle, and trailing actions. Grouped with the
 * banner landmark so navigation aids can jump straight to chit-chat.
 */
export function ChatHeader({ title, subtitle, avatar, onBack, actions, backLabel = 'Go back', className, style }: ChatHeaderProps) {
  return (
    <header
      className={cn('wco-chat-header', className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: sem('bg'),
        borderBottom: `1px solid ${sem('border')}`,
        minHeight: 52,
        ...style,
      }}
    >
      {onBack && (
        <button
          type="button"
          aria-label={backLabel}
          onClick={onBack}
          style={{
            border: 'none',
            background: 'transparent',
            color: sem('text'),
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="chevronLeft" aria-hidden />
        </button>
      )}
      {avatar && <Avatar name={title} size={38} {...avatar} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 14.5, fontFamily: 'var(--font-inter, system-ui)', color: sem('text'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ display: 'block', fontSize: 12, color: sem('textMuted'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </span>
        )}
      </span>
      {actions && (
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {actions}
        </span>
      )}
    </header>
  );
}