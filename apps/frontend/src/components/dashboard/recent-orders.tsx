'use client';

import Link from 'next/link';
import { Badge, Card, Spinner, EmptyState } from '../../components/ui';
import { formatMoney } from '../../lib/utils/format';
import { cn } from '../../lib/utils/format';
import type { RecentOrder } from '../../hooks/use-dashboard';

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PROCESSING: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  SHIPPED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-600/20',
  REFUNDED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface RecentOrdersProps {
  orders?: { items: RecentOrder[] };
  isLoading: boolean;
}

export function RecentOrders({ orders, isLoading }: RecentOrdersProps) {
  const items = orders?.items ?? [];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Orders</h3>
        <Link
          href="/orders"
          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="py-6">
          <EmptyState title="No orders yet" description="Orders will appear here as they come in." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">Order</th>
                <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">Customer</th>
                <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">Total</th>
                <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">Status</th>
                <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {items.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                    {order.orderNumber}
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-400">
                    {order.customerName}
                  </td>
                  <td className="py-2.5 font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatMoney(order.total)}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                        STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-500 dark:text-slate-400">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
