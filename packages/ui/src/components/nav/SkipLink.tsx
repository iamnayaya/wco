import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * SkipLink — an accessibility affordance that appears on focus and jumps the
 * user to the main content region. Place it as the first element in the page.
 */
export interface SkipLinkProps {
  /** Target anchor (e.g. '#main'). */
  target: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SkipLink({ target, children = 'Skip to content', className, style }: SkipLinkProps) {
  return (
    <a
      href={target}
      className={cn('wco-skip-link', className)}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 2000,
        background: sem('primary'),
        color: sem('primaryFg'),
        padding: '10px 16px',
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        textDecoration: 'none',
        transform: 'translateY(-150%)',
        transition: 'transform 150ms ease',
        ...style,
      }}
      data-wco-skip
    >
      <style>{`.wco-skip-link:focus{transform:translateY(0)}`}</style>
      {children}
    </a>
  );
}

export default SkipLink;
