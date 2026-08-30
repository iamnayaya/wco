'use client';

import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';
import type { PaginationMeta } from '../../lib/api/client';
import { formatMoney, formatRelativeTime } from '../../lib/utils/format';
import { isBadgedSegment, segmentLabel, toNumber } from './helpers';
import type { Customer, SORTABLE_FIELD } from './types';

interface CustomersTableProps {
  customers: Customer[];
  meta?: PaginationMeta;
  loading: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onSort: (field: SORTABLE_FIELD) => void;
  sortBy: SORTABLE_FIELD;
  sortOrder: 'asc' | 'desc';
  onView: (customer: Customer) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function CustomersTable({
  customers,
  meta,
  loading,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onSort,
  sortBy,
  sortOrder,
  onView,
  onPageChange,
  onPageSizeChange,
}: CustomersTableProps) {
  if (loading) {
    return (
      <Card className="flex items-center justify-center p-12">
        <Spinner className="h-6 w-6" />
      </Card>
    );
  }

  if (customers.length === 0) {
    return (
      <Card className="p-12">
        <EmptyState
          title="No customers found"
          description="Try clearing the filters, or create a customer from the button above."
        />
      </Card>
    );
  }

  const allSelected = customers.length > 0 && customers.every((c) => selected.has(c.id));

  function headerCell(label: string, field: SORTABLE_FIELD, right = false) {
    const active = sortBy === field;
    return (
      <th className={`px-4 py-3 ${right ? 'text-right' : ''}`}>
        <button
          type="button"
          onClick={() => onSort(field)}
          className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide ${right ? 'justify-end' : ''} ${active ? 'text-emerald-700' : 'text-slate-500'} hover:text-slate-800`}
          aria-label={`Sort by ${label}`}
          aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          {label}
          {active && <span aria-hidden>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
        </button>
      </th>
    );
  }

  const totalPages = meta?.totalPages ?? 1;
  const currentPage = meta?.page ?? 1;

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={allSelected}
                    onChange={() => onToggleSelectAll(customers.map((c) => c.id))}
                    aria-label="Select all customers"
                  />
                </th>
                {headerCell('Customer', 'name')}
                <th className="px-4 py-3">Contact</th>
                {headerCell('Orders', 'ordersCount', true)}
                {headerCell('Total spent', 'totalSpent', true)}
                {headerCell('Last order', 'lastOrderAt')}
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Segment</th>
                <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={selected.has(customer.id)}
                      onChange={() => onToggleSelect(customer.id)}
                      aria-label={`Select ${customer.name ?? customer.waPhone}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onView(customer)}
                      className="font-semibold text-slate-900 hover:text-emerald-700"
                    >
                      {customer.name || 'Unknown'}
                    </button>
                    <p className="text-xs text-slate-500">{customer.waPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {customer.email || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{customer.ordersCount}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatMoney(toNumber(customer.totalSpent))}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {customer.lastOrderAt ? formatRelativeTime(customer.lastOrderAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-40 flex-wrap gap-1">
                      {customer.tags.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        customer.tags.slice(0, 3).map((tag) => <Badge key={tag} label={tag} />)
                      )}
                      {customer.tags.length > 3 && (
                        <span className="text-xs text-slate-400">+{customer.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {customer.segment ? (
                      <Badge label={isBadgedSegment(customer.segment) ? customer.segment : segmentLabel(customer.segment)} tone={customer.segment as never} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => onView(customer)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <p className="text-xs text-slate-500">
          Page {currentPage} of {totalPages} · {meta?.totalItems} customers
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onPageSizeChange && (
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={meta?.pageSize ?? 20}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Customers per page"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="!px-3 !py-1.5 text-xs"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className="!px-3 !py-1.5 text-xs"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
