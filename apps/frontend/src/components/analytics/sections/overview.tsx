'use client';

import { AreaTrend } from '../charts';
import { Metric, MetricGrid } from '../metrics';
import { money } from '../helpers';
import { useSalesMetrics, useCustomerMetrics, useMessageMetrics, useDeliveryMetrics, usePaymentMetrics } from '../hooks';

export function OverviewSection({ from, to }: { from: string; to: string }) {
  const sales = useSalesMetrics({ from, to });
  const customers = useCustomerMetrics({ from, to });
  const messages = useMessageMetrics({ from, to });
  const deliveries = useDeliveryMetrics({ from, to });
  const payments = usePaymentMetrics({ from, to });

  const loading = sales.isLoading || customers.isLoading;
  const error = sales.isError || customers.isError || messages.isError || deliveries.isError || payments.isError;

  if (error) {
    return <p className="py-16 text-center text-sm text-red-500">Could not load overview metrics.</p>;
  }

  const trend = (sales.data?.dailySeries ?? []).map((d) => ({
    date: d.date,
    Revenue: Number(d.revenue) || 0,
  }));

  return (
    <div className="space-y-6">
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading overview…</p>
      ) : (
        <>
          <MetricGrid cols={4}>
            <Metric label="Revenue" value={money(sales.data?.totalRevenue, sales.data?.currency)} hint={growth(sales.data?.revenueGrowth)} />
            <Metric label="Orders" value={String(sales.data?.totalOrders ?? 0)} hint={growth(sales.data?.orderGrowth)} />
            <Metric label="Customers" value={String(customers.data?.totalCustomers ?? 0)} hint={`${customers.data?.newCustomers ?? 0} new`} />
            <Metric label="AI resolution" value={`${((messages.data?.aiResolutionRate ?? 0) * 100).toFixed(0)}%`} />
          </MetricGrid>
          <MetricGrid cols={3}>
            <Metric label="Payments success" value={`${((payments.data?.successRate ?? 0) * 100).toFixed(0)}%`} />
            <Metric label="Delivery success" value={`${((deliveries.data?.successRate ?? 0) * 100).toFixed(0)}%`} />
            <Metric label="Avg order value" value={money(sales.data?.averageOrderValue, sales.data?.currency)} />
          </MetricGrid>
        </>
      )}

      <AreaTrend
        title="Revenue trend"
        subtitle="Daily revenue over the selected period"
        data={trend}
        xKey="date"
        series={[{ key: 'Revenue', name: 'Revenue' }]}
        moneyValues={['Revenue']}
      />
    </div>
  );
}

function growth(v: number | null | undefined): string | undefined {
  if (v === null || v === undefined) return undefined;
  const pct = v * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
