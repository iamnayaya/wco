import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * SafeArea — wraps content and applies environment-safe padding for notched
 * devices / foldables using `env(safe-area-inset-*)`. Scale-aware and SSR-safe
 * (falls back to zero inset on non-supporting browsers).
 */
export interface SafeAreaProps {
  children: ReactNode;
  /** Which edges to apply safe-area padding to. */
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
  className?: string;
  style?: CSSProperties;
}

export function SafeArea({ children, edges = ['top', 'bottom'], className, style }: SafeAreaProps) {
  const pad: CSSProperties = {};
  if (edges.includes('top')) pad.paddingTop = 'max(0px, env(safe-area-inset-top))';
  if (edges.includes('bottom')) pad.paddingBottom = 'max(0px, env(safe-area-inset-bottom))';
  if (edges.includes('left')) pad.paddingLeft = 'max(0px, env(safe-area-inset-left))';
  if (edges.includes('right')) pad.paddingRight = 'max(0px, env(safe-area-inset-right))';

  return (
    <div className={cn('wco-safe-area', className)} style={{ ...pad, ...style }}>
      {children}
    </div>
  );
}

export default SafeArea;
