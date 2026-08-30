import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';

export interface SpacerProps {
  /** Fixed spacing in px, or `auto` to absorb remaining space (flex). */
  size?: number | 'auto';
  /** Only meaningful with `size='auto'`: absorb on this axis. */
  axis?: 'horizontal' | 'vertical';
  className?: string;
  style?: CSSProperties;
}

/**
 * Spacer — a layout atom for rhythm. Fixed sizes emit px, `auto` becomes a
 * flex filler (`flexGrow: 1`) along the chosen axis so toolbars and split
 * rows spread without media queries.
 */
export function Spacer({ size = 'auto', axis = 'horizontal', className, style }: SpacerProps) {
  const fixed = typeof size === 'number';
  const css: CSSProperties = {
    flexShrink: 0,
    width: fixed ? size : axis === 'horizontal' ? undefined : 0,
    height: fixed ? size : axis === 'vertical' ? undefined : 0,
    ...(size === 'auto' ? { flexGrow: 1, flexShrink: 1 } : undefined),
    ...style,
  };
  return <span aria-hidden className={cn('wco-spacer', className)} style={css} />;
}