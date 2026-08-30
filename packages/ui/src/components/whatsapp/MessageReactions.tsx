import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sem, motion } from '../../lib/styles';
import { useWcoI18n } from '../../lib/i18n';
import { Icon } from '../Icon';

export interface Reaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}

export interface MessageReactionsProps {
  reactions: readonly Reaction[];
  /** Toggle a reaction (treat `add` as the new state). */
  onToggle?: (emoji: string, add: boolean) => void;
  /** Add-reaction affordance (when provided, shows a trailing +). */
  onAdd?: () => void;
  /** Renders each pill as a toggle button with aria-pressed. */
  selectable?: boolean;
  align?: 'start' | 'end';
  className?: string;
  style?: CSSProperties;
}

/**
 * MessageReactions — the emoji-reaction rail. Pills are real buttons when
 * `selectable` (with `aria-pressed`), the group is labelled from the
 * "Reactions" string, and the whole row is opt-in for live chat.
 */
export function MessageReactions({ reactions, onToggle, onAdd, selectable = true, align = 'start', className, style }: MessageReactionsProps) {
  const { t } = useWcoI18n();

  return (
    <div
      role="group"
      aria-label={t.reactions}
      className={cn('wco-msg-reactions', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
        ...style,
      }}
    >
      {reactions.map((r) => {
        const inner = (
          <>
            <span aria-hidden>{r.emoji}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1 }}>{r.count}</span>
          </>
        );
        return selectable ? (
          <button
            type="button"
            key={r.emoji}
            onClick={() => onToggle?.(r.emoji, !r.reacted)}
            aria-pressed={r.reacted}
            aria-label={`${r.emoji} ${r.count}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              border: `1px solid ${sem('borderStrong')}`,
              borderRadius: 999,
              background: r.reacted ? sem('primarySoft') : sem('surface'),
              color: sem('text'),
              cursor: 'pointer',
              fontFamily: 'var(--font-inter, system-ui)',
              transition: `background-color ${motion.fast}, border-color ${motion.fast}`,
            }}
          >
            {inner}
          </button>
        ) : (
          <span
            key={r.emoji}
            aria-label={`${r.emoji} ${r.count}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              border: `1px solid ${sem('border')}`,
              borderRadius: 999,
              background: r.reacted ? sem('primarySoft') : sem('surface'),
              color: sem('text'),
              fontFamily: 'var(--font-inter, system-ui)',
            }}
          >
            {inner}
          </span>
        );
      })}
      {onAdd && (
        <button
          type="button"
          aria-label={t.reactions}
          onClick={onAdd}
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: `1px solid ${sem('borderStrong')}`,
            background: sem('surface'),
            color: sem('textMuted'),
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <Icon name="plus" size="sm" aria-hidden />
        </button>
      )}
    </div>
  );
}