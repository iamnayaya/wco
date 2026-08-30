import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';

/**
 * Breadcrumb — an ARIA `navigation` landmark breadcrumb trail with a
 * screen-reader-friendly separator.
 */
export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  current?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Replaces the default chevron separator. */
  separator?: ReactNode;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  /** Collapse items after the first N into a single "…" (mobile). */
  maxItems?: number;
}

export function Breadcrumb({ items, separator, ariaLabel = 'Breadcrumb', className, style, maxItems }: BreadcrumbProps) {
  const shown = maxItems && items.length > maxItems ? [items[0], ...items.slice(items.length - (maxItems - 1))] : items;
  const truncated = maxItems != null && items.length > maxItems;

  return (
    <nav aria-label={ariaLabel} className={cn('wco-breadcrumb', className)} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, ...style }}>
      <ol style={{ listStyle: 'none', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, margin: 0, padding: 0 }}>
        {truncated && (
          <li aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 4, color: sem('textFaint') }}>
            <span aria-hidden style={{ color: sem('textFaint') }}>…</span>
            <Sep sep={separator} />
          </li>
        )}
        {shown.map((item, i) => {
          const last = i === shown.length - 1;
          return (
            <li key={i} aria-current={item.current ? 'page' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {item.href || item.onClick ? (
                <a
                  href={item.href}
                  onClick={item.onClick}
                  aria-current={last ? 'page' : undefined}
                  style={{ color: last ? sem('text') : sem('textMuted'), textDecoration: 'none', fontSize: 13, fontWeight: last ? 600 : 400, borderRadius: radii.sm, padding: '2px 4px' }}
                >
                  {item.label}
                </a>
              ) : (
                <span style={{ color: last ? sem('text') : sem('textMuted'), fontSize: 13, fontWeight: last ? 600 : 400 }}>{item.label}</span>
              )}
              {!last && <Sep sep={separator} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Sep({ sep }: { sep?: ReactNode }) {
  return (
    <span aria-hidden style={{ color: sem('textFaint'), display: 'inline-flex', margin: '0 2px' }}>
      {sep ?? <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>}
    </span>
  );
}

export default Breadcrumb;
