'use client';

import { AreaTrend, BarCompare, Gauge } from '../charts';
import { Metric, MetricGrid } from '../metrics';
import { money } from '../helpers';
import { useDeliveryMetrics } from '../hooks';

export function DeliveriesSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading, isError } = useDeliveryMetrics({ from, to });

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading delivery metrics…</p>;
  }
  if (isError || !data) {
    return <p className="py-16 text-center text-sm text-red-500">Could not load delivery metrics.</p>;
  }

  const series = (data.dailySeries ?? []).map((d) => ({
    date: d.date,
    Delivered: Number(d.delivered) || 0,
    Failed: Number(d.failed) || 0,
  }));
  const carriers = (data.byCarrier ?? []).map((c) => ({ name: c.carrier, value: Number(c.count) || 0 }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Gauge title="Delivery success rate" value={(data.successRate ?? 0) * 100} suffix="%" />
        <div className="space-y-4">
          <MetricGrid cols={2}>
            <Metric label="Total deliveries" value={String(data.totalDeliveries ?? 0)} />
            <Metric label="Failed" value={String(data.failed ?? 0)} />
            <Metric label="Avg fee" value={money(data.averageFee)} />
            <Metric label="Avg rating" value={Number(data.averageRating ?? 0).toFixed(1)} />
          </MetricGrid>
        </div>
        <Metric label="Total claims" value={String(data.totalClaims ?? 0)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AreaTrend
          title="Delivery activity"
          subtitle="Delivered vs failed per day"
          data={series}
          xKey="date"
          series={[
            { key: 'Delivered', name: 'Delivered' },
            { key: 'Failed', name: 'Failed' },
          ]}
        />
        <BarCompare
          title="Deliveries by carrier"
          data={carriers}
          xKey="name"
          series={[{ key: 'value', name: 'Deliveries' }]}
        />
      </div>
    </div>
  );
}
