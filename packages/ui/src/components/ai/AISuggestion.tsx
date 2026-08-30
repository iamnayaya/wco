import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * AISuggestion — a dismissible "AI-generated" suggestion card with an accent
 * left bar. Marked `data-ai` for styling and clearly-labeled attribution for
 * transparency compliance.
 */
export interface AISuggestionProps {
  children: ReactNode;
  label?: string;
  onCopy?: () => void;
  onDismiss?: () => void;
  onApply?: () => void;
  confidence?: number;
  className?: string;
  style?: CSSProperties;
}

export function AISuggestion({ children, label = 'AI suggestion', onCopy, onDismiss, onApply, confidence, className, style }: AISuggestionProps) {
  const buttonBase: CSSProperties = {
    border: 'none',
    background: sem('bgSunken'),
    color: sem('textMuted'),
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
  };

  return (
    <div
      data-ai
      className={cn('wco-ai-suggestion', className)}
      style={{
        position: 'relative',
        padding: '12px 14px',
        paddingLeft: 18,
        background: sem('bgSunken'),
        borderRadius: 12,
        borderLeft: `3px solid ${sem('accent')}`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={sem('accent')} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: sem('accent') }}>{label}</span>
        {confidence !== undefined && (
          <span style={{ fontSize: 11, color: sem('textFaint') }}>{Math.round(confidence * 100)}% confidence</span>
        )}
      </div>
      <div style={{ color: sem('text'), fontSize: 14, lineHeight: 1.5 }}>{children}</div>
      {(onCopy || onApply || onDismiss) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {onApply && (
            <button type="button" onClick={onApply} style={{ ...buttonBase, background: sem('accent'), color: sem('accentFg') }}>
              Apply
            </button>
          )}
          {onCopy && <button type="button" onClick={onCopy} style={buttonBase}>Copy</button>}
          {onDismiss && <button type="button" onClick={onDismiss} style={{ ...buttonBase, marginLeft: 'auto' }} aria-label="Dismiss suggestion">✕</button>}
        </div>
      )}
    </div>
  );
}

export default AISuggestion;
