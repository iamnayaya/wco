import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * SkeletonText — shimmer placeholder lines for loading text, powered by the
 * theme's `skeleton-*` tokens (no external animation library).
 */
export interface SkeletonTextProps {
  /** Number of lines (default 3). */
  lines?: number;
  /** Last line is shorter when true (mimics a paragraph ending). */
  lastLineShort?: boolean;
  width?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function SkeletonText({ lines = 3, lastLineShort = true, width, className, style }: SkeletonTextProps) {
  const defaultWidth = (i: number) => (lastLineShort && i === lines - 1 ? '60%' : '100%');
  return (
    <div className={cn('wco-skeleton-text', className)} aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 8, width: width ?? '100%', ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          style={{
            display: 'block',
            height: 12,
            width: typeof width === 'number' || width ? width : defaultWidth(i),
            borderRadius: 4,
            background: sem('borderStrong'),
            animation: 'wco-shimmer 1.5s ease-in-out infinite',
          }}
        >
          <style>{`@keyframes wco-shimmer{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
        </span>
      ))}
    </div>
  );
}

export default SkeletonText;
