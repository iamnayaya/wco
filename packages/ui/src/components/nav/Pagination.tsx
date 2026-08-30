import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * Pagination — keyboard- and assistive-tech-friendly page navigation with
 * prev/next, page numbers, and ellipsis collapsing for long ranges.
 */
export interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Number of page buttons shown around the current page. */
  siblings?: number;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  renderPage?: (label: ReactNode, page: number) => ReactNode;
}

export function Pagination({ page, pageCount, onChange, siblings = 1, ariaLabel = 'Pagination', className, style, renderPage }: PaginationProps) {
  const clamp = (p: number) => Math.max(1, Math.min(pageCount, p));
  const pages = usePages(page, pageCount, siblings);
  const navBtn: CSSProperties = {
    border: `1px solid ${sem('borderStrong')}`,
    background: sem('surface'),
    color: sem('text'),
    width: 36,
    height: 36,
    borderRadius: 8,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
  };

  return (
    <nav aria-label={ariaLabel} className={cn('wco-pagination', className)} style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(clamp(page - 1))} style={{ ...navBtn, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e${i}`} aria-hidden style={{ color: sem('textFaint'), width: 24, textAlign: 'center' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            style={{
              ...navBtn,
              background: p === page ? sem('primary') : sem('surface'),
              color: p === page ? sem('primaryFg') : sem('text'),
              fontWeight: p === page ? 600 : 400,
              borderColor: p === page ? sem('primary') : sem('borderStrong'),
            }}
          >
            {renderPage ? renderPage(p, p) : p}
          </button>
        ),
      )}

      <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onChange(clamp(page + 1))} style={{ ...navBtn, opacity: page >= pageCount ? 0.4 : 1, cursor: page >= pageCount ? 'not-allowed' : 'pointer' }}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    </nav>
  );
}

function usePages(page: number, pageCount: number, siblings: number): Array<number | 'ellipsis'> {
  const total = pageCount;
  const start = Math.max(2, page - siblings);
  const end = Math.min(total - 1, page + siblings);
  const res: Array<number | 'ellipsis'> = [1];
  if (start > 2) res.push('ellipsis');
  for (let p = start; p <= end; p++) res.push(p);
  if (end < total - 1) res.push('ellipsis');
  if (total > 1) res.push(total);
  return res;
}

export default Pagination;
