import type { CSSProperties } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export interface SkeletonProps {
  /** Shap preset. */
  variant?: 'text' | 'circle' | 'rect' | 'card';
  width?: number | string;
  height?: number | string;
  /** Hide from screen readers (decorative while real content loads). */
  className?: string;
  style?: CSSProperties;
}

/**
 * Theme-aware loading placeholder. Always pairs with real, accessible content
 * (e.g. `aria-label` on the container) — never renders as the only content.
 */
export function Skeleton({ variant = 'text', width, height, className, style }: SkeletonProps) {
  const css: CSSProperties = {
    display: 'inline-block',
    width: width ?? (variant === 'text' ? '100%' : 80),
    height: height ?? (variant === 'text' ? 12 : variant === 'circle' ? 40 : 96),
    borderRadius: variant === 'circle' ? '50%' : variant === 'text' ? 6 : 12,
    background: sem('bgSunken'),
    ...style,
  };
  return (
    <span aria-hidden className={cn('wco-skeleton', className)} style={css} />
  );
}