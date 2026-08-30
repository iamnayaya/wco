import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { useId } from '../../lib/hooks';
import { Icon } from '../Icon';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export interface AiChatStrings {
  inputPlaceholder: string;
  send: string;
  empty: string;
  typing: string;
}

export interface AIChatProps {
  messages: readonly AiChatMessage[];
  onSend: (text: string) => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
  /** Quick prompts rendered as chips above the input. */
  suggestions?: readonly string[];
  /** Fixed panel height; defaults to 460px. */
  height?: number;
  strings?: Partial<AiChatStrings>;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_STRINGS: AiChatStrings = {
  inputPlaceholder: 'Ask AIâ€¦',
  send: 'Send message',
  empty: 'Start a conversation with AI',
  typing: 'AI is thinkingâ€¦',
};

/**
 * AIChat â€” a conversation panel with user/AI bubbles, suggestion chips and a
 * reachable textarea (label + send button). The thread is `aria-live="politely"`
 * so new messages are announced; suggestions fill the input, not send it.
 */
export function AIChat({
  messages,
  onSend,
  disabled = false,
  title,
  subtitle,
  suggestions,
  height = 460,
  strings,
  className,
  style,
}: AIChatProps) {
  const s = { ...DEFAULT_STRINGS, ...strings };
  const listId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  };

  return (
    <div
      className={cn('wco-ai-chat', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: sem('surface'),
        border: `1px solid ${sem('border')}`,
        borderRadius: radii.lg,
        boxShadow: shadows.card,
        overflow: 'hidden',
        height,
        ...style,
      }}
    >
      {(title || subtitle) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: `1px solid ${sem('border')}`,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: sem('primarySoft'),
              color: sem('primary'),
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            AI
          </span>
          <span style={{ minWidth: 0 }}>
            {title && (
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>{title}</span>
            )}
            {subtitle && <span style={{ display: 'block', fontSize: 12, color: sem('textMuted') }}>{subtitle}</span>}
          </span>
        </header>
      )}

      <div
        ref={scrollRef}
        aria-live="polite"
        aria-atomic="false"
        style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: sem('textFaint') }}>
            {s.empty}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              data-role={m.role}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                padding: '9px 12px',
                borderRadius: radii.lg,
                fontSize: 13.5,
                lineHeight: 1.5,
                background: m.role === 'user' ? sem('primary') : sem('bgSunken'),
                color: m.role === 'user' ? sem('primaryFg') : sem('text'),
                borderBottomRightRadius: m.role === 'user' ? 4 : undefined,
                borderBottomLeftRadius: m.role === 'ai' ? 4 : undefined,
              }}
            >
              {m.content}
            </div>
          ))
        )}
      </div>

      {suggestions && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 14px 10px' }}>
          {suggestions.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && setValue(prompt)}
              style={{
                border: `1px solid ${sem('borderStrong')}`,
                background: 'transparent',
                color: sem('textMuted'),
                fontSize: 12.5,
                padding: '5px 10px',
                borderRadius: 999,
                cursor: disabled ? 'default' : 'pointer',
                fontFamily: 'var(--font-inter, system-ui)',
                transition: `background-color ${motion.fast}, color ${motion.fast}`,
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${sem('border')}` }}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          rows={1}
          placeholder={s.inputPlaceholder}
          aria-label={s.send}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          style={{
            flex: 1,
            resize: 'none',
            border: `1px solid ${sem('borderStrong')}`,
            borderRadius: radii.md,
            background: sem('bgSunken'),
            color: sem('text'),
            fontFamily: 'inherit',
            fontSize: 14,
            padding: '9px 12px',
            lineHeight: 1.4,
          }}
        />
        <button
          type="submit"
          aria-label={s.send}
          disabled={disabled || !value.trim()}
          style={{
            border: 'none',
            width: 40,
            height: 40,
            borderRadius: radii.md,
            background: sem('primary'),
            color: sem('primaryFg'),
            cursor: disabled || !value.trim() ? 'default' : 'pointer',
            opacity: disabled || !value.trim() ? 0.45 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'flex-end',
          }}
        >
          <Icon name="arrowUp" aria-hidden />
        </button>
      </form>
    </div>
  );
}