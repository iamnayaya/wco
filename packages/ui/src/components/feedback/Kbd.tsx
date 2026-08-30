import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';

export interface KbdProps {
  children: string;
  className?: string;
  style?: CSSProperties;
  /** Render the label with a keycap glyph look. */
  variant?: 'default' | 'card';
}

function keyLabel(children: string): string[] {
  return children
    .split('+')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Kbd â€” a keyboard-shortcut keycap. Text is uppercased visually but the
 * DOM text stays as-authored (case-insensitive matching for CSS text).
 * The `<kbd>` semantic maps to `role="text"` in the accessibility tree.
 */
export function Kbd({ children, variant = 'card', className, style }: KbdProps) {
  const keys = keyLabel(children);

  return (
    <kbd
      className={cn('wco-kbd', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        paddingInline: variant === 'card' ? 7 : 5,
        paddingBlock: 2,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        fontSize: 12,
        lineHeight: 1.4,
        color: sem('textMuted'),
        background: variant === 'card' ? sem('bgSunken') : 'transparent',
        border: variant === 'card' ? `1px solid ${sem('borderStrong')}` : 'none',
        borderBottomWidth: variant === 'card' ? 3 : 0,
        borderRadius: radii.sm,
        minWidth: 20,
        justifyContent: 'center',
        textTransform: 'uppercase',
        fontVariant: 'normal',
        ...style,
      }}
    >
      {keys.map((key, i) => (
        <span key={`${key}-${i}`} style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
          {i > 0 && <span style={{ marginInlineEnd: 4, opacity: 0.55 }}>+</span>}
          {key}
        </span>
      ))}
    </kbd>
  );
}