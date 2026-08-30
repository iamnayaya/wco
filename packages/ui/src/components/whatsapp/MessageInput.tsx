import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { useControllableState } from '../../lib/hooks';

/**
 * MessageInput — a WhatsApp-style composer: mentions-friendly text area with
 * Enter-to-send (Shift+Enter for newline), attachment/send affordances, and
 * an auto-growing height. Reachable and theme-aware.
 */
export interface MessageInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSend?: (value: string) => void;
  onAttach?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Min/max text area height (px). */
  minRows?: number;
  maxRows?: number;
  sendLabel?: string;
  className?: string;
  style?: CSSProperties;
  /** Show a typing indicator inside (e.g. while the request is in flight). */
  busy?: boolean;
}

export function MessageInput({
  value,
  defaultValue = '',
  onChange,
  onSend,
  onAttach,
  placeholder = 'Type a message',
  disabled = false,
  minRows = 1,
  maxRows = 6,
  sendLabel = 'Send',
  className,
  style,
  busy = false,
}: MessageInputProps) {
  const [val, setVal] = useControllableState<string>({ value, defaultValue, onChange });
  const taRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 24 * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  };

  const send = () => {
    const t = val.trim();
    if (!t || disabled) return;
    onSend?.(t);
    setVal('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      className={cn('wco-message-input', className)}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: 8,
        background: sem('surface'),
        border: `1px solid ${sem('borderStrong')}`,
        borderRadius: 14,
        ...style,
      }}
    >
      {onAttach && (
        <button type="button" aria-label="Attach file" onClick={onAttach} style={{ border: 'none', background: 'transparent', color: sem('textFaint'), cursor: 'pointer', padding: 6, display: 'inline-flex' }}>
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        </button>
      )}
      <textarea
        ref={taRef}
        rows={minRows}
        value={val}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setVal(e.target.value);
          autoGrow();
        }}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          minHeight: 24 * minRows,
          maxHeight: 24 * maxRows,
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-inter, system-ui)',
          fontSize: 14,
          lineHeight: 1.5,
          color: sem('text'),
        }}
      />
      {busy && (
        <div role="status" aria-label="Sending" style={{ display: 'inline-flex', gap: 3, padding: '0 6px' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden style={{ width: 4, height: 4, borderRadius: '50%', background: sem('textFaint'), animation: 'wco-bounce 1s infinite', animationDelay: `${i * 150}ms` }}>
              <style>{`@keyframes wco-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label={sendLabel}
        disabled={disabled || !val.trim()}
        onClick={send}
        style={{
          border: 'none',
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: val.trim() && !disabled ? sem('primary') : sem('borderStrong'),
          color: val.trim() && !disabled ? sem('primaryFg') : sem('textFaint'),
          cursor: val.trim() && !disabled ? 'pointer' : 'not-allowed',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor"><path d="M2.4 2.9L21.6 12 2.4 21.1l3-8.1L2.4 2.9z" /></svg>
      </button>
    </div>
  );
}

export default MessageInput;
