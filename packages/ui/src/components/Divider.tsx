import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem, type Tone } from '../lib/styles';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Label/slot centered on the line. */
  children?: ReactNode;
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
}

const TONE_COLOR: Record<Tone, string> = {
  neutral: sem('border'),
  success: sem('successText'),
  warning: sem('warningText'),
  danger: sem('dangerText'),
  info: sem('infoText'),
};

/** Visual separator with an optional centered label. */
export function Divider({ orientation = 'horizontal', children, tone = 'neutral', className, style }: DividerProps) {
  const color = TONE_COLOR[tone];
  if (orientation === 'vertical') {
    return (
      <span
        aria-hidden
        className={cn('wco-divider', className)}
        style={{ display: 'inline-block', alignSelf: 'stretch', width: 1, background: color, minHeight: '1em', ...style }}
      />
    );
  }
  if (!children) {
    return <hr aria-hidden className={cn('wco-divider', className)} style={{ border: 'none', borderTop: `1px solid ${color}`, width: '100%', margin: 0, ...style }} />;
  }
  return (
    <div role="separator" className={cn('wco-divider', className)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', ...style }}>
      <span style={{ flex: 1, borderTop: `1px solid ${color}` }} />
      <span style={{ fontSize: 12, color: sem('textMuted'), whiteSpace: 'nowrap' }}>{children}</span>
      <span style={{ flex: 1, borderTop: `1px solid ${color}` }} />
    </div>
  );
}