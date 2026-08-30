'use client';

import { AreaTrend, BarCompare } from '../charts';
import { money } from '../helpers';
import type { SalesMetrics } from '../types';
import { useSalesMetrics } from '../hooks';
import { Metric, MetricGrid } from '../metrics';

export function SalesSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading, isError } = useSalesMetrics({ from, to });

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading sales metrics…</p>;
  }
  if (isError || !data) {
    return <p className="py-16 text-center text-sm text-red-500">Could not load sales metrics.</p>;
  }

  const trend = (data.dailySeries ?? []).map((d) => ({
    date: d.date,
    revenue: Number(d.revenue) || 0,
  }));
  const orders = (data.dailySeries ?? []).map((d) => ({
    date: d.date,
    orders: Number(d.orders) || 0,
  }));

  return (
    <div className="space-y-6">
      <MetricGrid>
        <Metric label="Total revenue" value={money(data.totalRevenue, data.currency)} />
        <Metric label="Total orders" value={String(data.totalOrders ?? 0)} />
        <Metric label="Avg order value" value={money(data.averageOrderValue, data.currency)} />
        <Metric label="Revenue growth" value={`${((data.revenueGrowth ?? 0) * 100).toFixed(1)}%`} />
      </MetricGrid>
      <div className="grid gap-6 lg:grid-cols-2">
        <AreaTrend
          title="Revenue"
          subtitle="Daily revenue over the selected period"
          data={trend}
          xKey="date"
          series={[{ key: 'revenue', name: 'Revenue' }]}
          moneyValues={['revenue']}
        />
        <BarCompare
          title="Orders"
          subtitle="Daily order count"
          data={orders}
          xKey="date"
          series={[{ key: 'orders', name: 'Orders' }]}
        />
      </div>
    </div>
  );
}
