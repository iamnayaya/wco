import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * DataTable — an accessible, sortable table with sticky headers, row
 * selection, and a semantic `<table>`/`<caption>` structure. Styling is
 * theme-aware via inline styles.
 */
export interface DataColumn<Row> {
  key: string;
  header: ReactNode;
  /** Accessor or custom cell renderer. */
  cell: (row: Row) => ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  width?: number | string;
  /** Optional sort comparator. Defaults to string/number compare on value. */
  sortValue?: (row: Row) => string | number;
  hideOnMobile?: boolean;
}

export interface DataTableProps<Row> {
  columns: DataColumn<Row>[];
  rows: Row[];
  /** Optional stable row id (for selection/sort keys). */
  getRowId?: (row: Row) => string | number;
  rowKey?: (row: Row, index: number) => string;
  caption?: ReactNode;
  /** Rendered in an empty-state row when `rows` is empty. */
  empty?: ReactNode;
  onRowClick?: (row: Row) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  initialSort?: { key: string; direction: 'asc' | 'desc' };
  className?: string;
  style?: CSSProperties;
  zebra?: boolean;
}

export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  rowKey,
  caption,
  empty,
  onRowClick,
  onSort,
  initialSort,
  className,
  style,
  zebra = true,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortable) return rows;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue ? col.sortValue(a) : String((a as Record<string, unknown>)[col.key] ?? '');
      const vb = col.sortValue ? col.sortValue(b) : String((b as Record<string, unknown>)[col.key] ?? '');
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, columns, sort]);

  const handleSort = (col: DataColumn<Row>) => {
    if (!col.sortable) return;
    let next: { key: string; direction: 'asc' | 'desc' };
    if (sort?.key === col.key) {
      next = { key: col.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
    } else {
      next = { key: col.key, direction: 'asc' };
    }
    setSort(next);
    onSort?.(next.key, next.direction);
  };

  return (
    <div className={cn('wco-data-table', className)} style={{ overflowX: 'auto', ...style }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        {caption && <caption style={{ textAlign: 'left', fontSize: 12, color: sem('textFaint'), marginBottom: 8 }}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                aria-sort={col.sortable && sort?.key === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                scope="col"
                align={col.align}
                style={{
                  textAlign: col.align ?? 'left',
                  padding: '10px 12px',
                  background: sem('bgSunken'),
                  color: sem('textMuted'),
                  fontWeight: 600,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderBottom: `1px solid ${sem('border')}`,
                  whiteSpace: 'nowrap',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
                onClick={() => handleSort(col)}
              >
                {col.sortable ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.header}
                    <span aria-hidden style={{ fontSize: 10, color: sort?.key === col.key ? sem('primary') : sem('textFaint') }}>
                      {sort?.key === col.key ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </span>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && empty != null && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 32, textAlign: 'center', color: sem('textFaint') }}>
                {empty}
              </td>
            </tr>
          )}
          {sorted.map((row, i) => {
            const rid = getRowId ? getRowId(row) : rowKey?.(row, i) ?? i;
            return (
              <tr
                key={rid}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  background: zebra && i % 2 === 1 ? sem('bgSunken') : 'transparent',
                  borderBottom: `1px solid ${sem('border')}`,
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 100ms ease',
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    align={col.align}
                    style={{
                      padding: '12px',
                      textAlign: col.align ?? 'left',
                      color: sem('text'),
                      display: col.hideOnMobile ? 'none' : undefined,
                    }}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
