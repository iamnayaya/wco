import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';
import { space } from '../design-tokens/layout';

export interface StackProps {
  /** Primary axis. `row` / `column`. */
  direction?: 'row' | 'column';
  /** Gap from the design-token spacing scale. */
  gap?: keyof typeof space | number;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: CSSProperties['flexWrap'];
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Semantic gap value (token name or raw number). */
export function gapValue(gap: StackProps['gap']): string {
  if (typeof gap === 'number') return `${gap}px`;
  return space[gap ?? 'md'];
}

/** Flex stack with token-scoped spacing (the core building block of layout). */
export function Stack({
  direction = 'column',
  gap = 'md',
  align,
  justify,
  wrap,
  fullWidth = false,
  className,
  style,
  children,
}: StackProps) {
  const css: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap,
    gap: gapValue(gap),
    width: fullWidth ? '100%' : undefined,
    ...style,
  };
  return <div className={cn('wco-stack', className)} style={css}>{children}</div>;
}

/** Shorthand for a horizontal Stack (row flow). */
export function HStack(props: Omit<StackProps, 'direction'>) {
  return <Stack direction="row" {...props} />;
}

/** Shorthand for a vertical Stack (column flow). */
export function VStack(props: Omit<StackProps, 'direction'>) {
  return <Stack direction="column" {...props} />;
}