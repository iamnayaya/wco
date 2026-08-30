'use client';

import { useRef, useState } from 'react';
import { Button, StatCard } from '../../../components/ui';
import { useAuthStore } from '../../../store/slices/auth-slice';
import { formatMoney } from '../../../lib/utils/format';
import { useOrdersList, useOrderStats } from '../../../components/orders/hooks';
import { OrdersFilter } from '../../../components/orders/orders-filter';
import { OrdersTable } from '../../../components/orders/orders-table';
import { CreateOrderModal } from '../../../components/orders/create-order-modal';
import { OrderDetailModal } from '../../../components/orders/order-detail-modal';
import { exportOrdersCsv, importOrdersCsv } from '../../../components/orders/api';
import type { OrderChannel, OrderListItem, OrderStatus } from '../../../components/orders/types';

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isOwnerAdmin = role === 'OWNER' || role === 'ADMIN';

  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [channel, setChannel] = useState<OrderChannel | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [viewOrder, setViewOrder] = useState<OrderListItem | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orders = useOrdersList({ page, pageSize: PAGE_SIZE, status, channel, q: search || undefined });
  const stats = useOrderStats();

  function onChanged() {
    setViewOrder(null);
  }

  function handleExport() {
    exportOrdersCsv({ status, channel, q: search || undefined });
  }

  async function handleImportFile(file: File) {
    const report = await importOrdersCsv(file);
    setImportMsg(`Imported ${report.created} orders${report.failedRows.length ? `, ${report.failedRows.length} failed` : ''}.`);
    window.setTimeout(() => setImportMsg(null), 6000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">Orders</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={handleExport}>
            Export CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Import orders CSV"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </Button>
          <Button className="!px-3 !py-2 text-xs" onClick={() => setShowCreate(true)}>
            + New order
          </Button>
        </div>
      </div>

      {/* Import result notification */}
      {importMsg && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {importMsg}
        </div>
      )}

      {/* Stats */}
      {stats.data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total orders" value={String(stats.data.total)} />
          <StatCard label="Revenue" value={formatMoney(stats.data.revenue)} />
          <StatCard label="Avg order value" value={formatMoney(stats.data.avgOrderValue)} />
          <StatCard label="Fulfilment rate" value={`${Math.round(stats.data.fulfilmentRate)}%`} />
        </div>
      ) : null}

      {/* Filters */}
      <OrdersFilter
        status={status}
        channel={channel}
        search={search}
        onStatusChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
        onChannelChange={(c) => {
          setChannel(c);
          setPage(1);
        }}
        onSearchChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
      />

      <OrdersTable
        orders={orders.data?.items ?? []}
        meta={orders.data?.meta}
        loading={orders.isLoading}
        onView={setViewOrder}
        onPageChange={setPage}
      />

      {viewOrder && (
        <OrderDetailModal
          orderId={viewOrder.id}
          orderNumber={viewOrder.orderNumber}
          customerName={viewOrder.customer?.name}
          customerPhone={viewOrder.customer?.waPhone}
          isOwnerAdmin={isOwnerAdmin}
          onClose={() => setViewOrder(null)}
          onChanged={onChanged}
        />
      )}
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); setPage(1); }} />}
    </div>
  );
}
