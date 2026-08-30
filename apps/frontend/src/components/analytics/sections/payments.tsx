'use client';

import { AreaTrend, PieDist } from '../charts';
import { Metric, MetricGrid } from '../metrics';
import { usePaymentMetrics } from '../hooks';

export function PaymentsSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading, isError } = usePaymentMetrics({ from, to });

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading payment metrics…</p>;
  }
  if (isError || !data) {
    return <p className="py-16 text-center text-sm text-red-500">Could not load payment metrics.</p>;
  }

  const series = (data.dailySeries ?? []).map((d) => ({
    date: d.date,
    ...(moneyKeyed(d)),
  }));
  const providers = (data.byProvider ?? []).map((p) => ({ name: p.provider, value: Number(p.count) || 0 }));
  const methods = (data.byMethod ?? []).map((m) => ({ name: m.type, value: Number(m.count) || 0 }));

  return (
    <div className="space-y-6">
      <MetricGrid cols={4}>
        <Metric label="Total payments" value={String(data.totalPayments ?? 0)} />
        <Metric label="Succeeded" value={String(data.succeeded ?? 0)} />
        <Metric label="Failed" value={String(data.failed ?? 0)} />
        <Metric label="Success rate" value={`${((data.successRate ?? 0) * 100).toFixed(1)}%`} />
      </MetricGrid>
      <div className="grid gap-6 lg:grid-cols-2">
        <AreaTrend
          title="Payment volume"
          subtitle="Daily payment count and total amount"
          data={series}
          xKey="date"
          series={[
            { key: 'Payment count', name: 'Payment count' },
            { key: 'Amount', name: 'Amount' },
          ]}
          moneyValues={['Amount']}
        />
        <div className="grid gap-6">
          <PieDist title="By provider" data={providers} />
          <PieDist title="By method" data={methods} />
        </div>
      </div>
    </div>
  );
}

function moneyKeyed(d: { date: string; total: number; succeeded: number; amount: number }): Record<string, number> {
  return {
    'Payment count': Number(d.total || d.succeeded) || 0,
    Amount: Number(d.amount) || 0,
  };
}
