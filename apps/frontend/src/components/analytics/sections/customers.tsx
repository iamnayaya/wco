'use client';

import { Users, UserPlus, Repeat } from 'lucide-react';
import { Metric, MetricGrid } from '../metrics';
import { money } from '../helpers';
import { useCustomerMetrics } from '../hooks';

export function CustomersSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading, isError } = useCustomerMetrics({ from, to });

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading customer metrics…</p>;
  }
  if (isError || !data) {
    return <p className="py-16 text-center text-sm text-red-500">Could not load customer metrics.</p>;
  }

  return (
    <div className="space-y-6">
      <MetricGrid>
        <Metric label="Total customers" value={String(data.totalCustomers ?? 0)} icon={<Users className="h-3.5 w-3.5" />} />
        <Metric label="New customers" value={String(data.newCustomers ?? 0)} icon={<UserPlus className="h-3.5 w-3.5" />} />
        <Metric label="Returning" value={String(data.returningCustomers ?? 0)} icon={<Repeat className="h-3.5 w-3.5" />} />
        <Metric label="Retention rate" value={`${((data.retentionRate ?? 0) * 100).toFixed(1)}%`} />
      </MetricGrid>
      <MetricGrid cols={3}>
        <Metric label="Acquisition growth" value={`${((data.acquisitionGrowth ?? 0) * 100).toFixed(1)}%`} />
        <Metric label="Avg lifetime value" value={money(data.averageLifetimeValue)} />
        <Metric label="Avg orders / customer" value={Number(data.averageOrdersPerCustomer ?? 0).toFixed(2)} />
      </MetricGrid>
    </div>
  );
}
