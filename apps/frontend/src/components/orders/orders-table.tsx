'use client';

import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';
import type { PaginationMeta } from '../../lib/api/client';
import { formatRelativeTime } from '../../lib/utils/format';
import { channelLabel, formatOrderMoney } from './helpers';
import type { OrderListItem } from './types';
import { toNumber } from './types';

interface OrdersTableProps {
  orders: OrderListItem[];
  meta?: PaginationMeta;
  loading: boolean;
  onView: (order: OrderListItem) => void;
  onPageChange: (page: number) => void;
}

export function OrdersTable({ orders, meta, loading, onView, onPageChange }: OrdersTableProps) {
  if (loading) {
    return (
      <Card className="flex items-center justify-center p-12">
        <Spinner className="h-6 w-6" />
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-12">
        <EmptyState
          title="No orders found"
          description="Try clearing the filters, or create an order from the button above."
        />
      </Card>
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
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onView(order)}
                      className="font-semibold text-slate-900 hover:text-emerald-700"
                    >
                      {order.orderNumber}
                    </button>
                    <p className="text-xs text-slate-500">
                      {order.fraudScore !== null && order.fraudScore >= 70 ? '⚠️ Flagged for review' : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{order.customer?.name || 'Unknown'}</p>
                    {order.customer?.waPhone && <p className="text-xs text-slate-500">{order.customer.waPhone}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{channelLabel(order.channel)}</td>
                  <td className="px-4 py-3"><Badge label={order.status} /></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatOrderMoney(toNumber(order.total), order.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatRelativeTime(order.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => onView(order)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages} · {meta?.totalItems} orders
          </p>
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
      )}
    </>
  );
}
