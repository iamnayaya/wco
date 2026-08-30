'use client';

import { AreaTrend, Gauge } from '../charts';
import { Metric, MetricGrid } from '../metrics';
import { useMessageMetrics } from '../hooks';

export function MessagesSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading, isError } = useMessageMetrics({ from, to });

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading message metrics…</p>;
  }
  if (isError || !data) {
    return <p className="py-16 text-center text-sm text-red-500">Could not load message metrics.</p>;
  }

  const series = (data.dailySeries ?? []).map((d) => ({
    date: d.date,
    'AI resolved': Number(d.ai) || 0,
    Escalated: Number(d.escalated) || 0,
    Total: Number(d.total) || 0,
  }));

  return (
    <div className="space-y-6">
      <MetricGrid cols={3}>
        <Metric label="Total conversations" value={String(data.totalConversations ?? 0)} />
        <Metric label="AI resolved" value={String(data.aiResolved ?? 0)} />
        <Metric label="Escalated" value={String(data.escalated ?? 0)} />
      </MetricGrid>
      <div className="grid gap-6 lg:grid-cols-3">
        <Gauge title="AI resolution rate" value={(data.aiResolutionRate ?? 0) * 100} suffix="%" />
        <Gauge title="Escalation rate" value={(data.escalationRate ?? 0) * 100} suffix="%" />
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avg response time</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{secs(data.avgResponseSeconds)}</p>
        </div>
      </div>
      <AreaTrend
        title="Conversation volume"
        subtitle="AI-resolved vs escalated per day"
        data={series}
        xKey="date"
        series={[
          { key: 'AI resolved', name: 'AI resolved' },
          { key: 'Escalated', name: 'Escalated' },
        ]}
      />
    </div>
  );
}

function secs(v: number | null | undefined): string {
  const s = Number(v ?? 0);
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  return `${(s / 60).toFixed(1)}m`;
}
