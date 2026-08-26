'use client';

import { useState } from 'react';
import { useOrders, useUpdateOrderStatus, type Order } from '../../../hooks/use-orders';
import { Badge, Button, EmptyState, Spinner } from '../../../components/ui';
import { formatMoney, formatRelativeTime } from '../../../lib/utils/format';

const STATUS_FILTERS = ['ALL', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export default function OrdersPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const orders = useOrders({ limit: 20, status });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Orders</h1>
        <div className="flex gap-1.5 overflow-x-auto">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setStatus(filter === 'ALL' ? undefined : filter)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                (filter === 'ALL' && !status) || status === filter
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter === 'ALL' ? 'All' : filter.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {orders.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (orders.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No orders yet" description="Orders created in chats and the dashboard appear here." />
      ) : (
        <>
          <ul className="space-y-2">
            {orders.data?.items.map((order: Order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
          {orders.data?.nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                loading={orders.isFetching}
                onClick={() =>
                  void orders.refetch() // cursor pages handled by query params in v1
                }
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const updateStatus = useUpdateOrderStatus();

  return (
    <li className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
        <p className="text-xs text-slate-500">{formatRelativeTime(order.createdAt)}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tabular-nums">{formatMoney(order.total ?? order.subtotal ?? 0)}</span>
        <Badge label={order.status} />
        {order.status === 'PAID' && (
          <Button
            variant="ghost"
            className="!py-1 !px-2 text-xs"
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ id: order.id, status: 'PROCESSING' })}
          >
            Mark processing
          </Button>
        )}
        {order.status === 'PROCESSING' && (
          <Button
            variant="ghost"
            className="!py-1 !px-2 text-xs"
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ id: order.id, status: 'SHIPPED' })}
          >
            Mark shipped
          </Button>
        )}
        {order.status === 'SHIPPED' && (
          <Button
            variant="ghost"
            className="!py-1 !px-2 text-xs"
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ id: order.id, status: 'DELIVERED' })}
          >
            Mark delivered
          </Button>
        )}
      </div>
    </li>
  );
}
