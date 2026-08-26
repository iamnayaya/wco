'use client';

import { useAnalyticsSummary, useTopProducts, useFunnel } from '../../../hooks/use-analytics';
import { Card, Spinner, StatCard } from '../../../components/ui';
import { formatMoney } from '../../../lib/utils/format';

export default function AnalyticsPage() {
  const summary = useAnalyticsSummary();
  const topProducts = useTopProducts();
  const funnel = useFunnel();

  if (summary.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center"><Spinner /></div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-900">Analytics</h1>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue today" value={formatMoney(summary.data?.today.revenue ?? 0)} delta={summary.data?.vsYesterday.revenueDeltaPct ?? null} />
        <StatCard label="Orders today" value={String(summary.data?.today.orders ?? 0)} delta={summary.data?.vsYesterday.ordersDeltaPct ?? null} />
        <StatCard label="Week revenue" value={formatMoney(summary.data?.week.revenue ?? 0)} />
        <StatCard label="AI resolution rate" value={`${Math.round((summary.data?.week.aiResolutionRate ?? 0) * 100)}%`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Top products (30 days)</h2>
          <ol className="mt-3 space-y-2">
            {(topProducts.data ?? []).map((p, i) => {
              const max = Math.max(...(topProducts.data ?? [{ revenue: 1 }]).map((x) => x.revenue), 1);
              return (
                <li key={p.productId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate pr-2">
                      <span className="mr-1.5 text-xs font-bold text-slate-400">{i + 1}.</span>
                      {p.name}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatMoney(p.revenue)} <span className="font-normal text-slate-400">· {p.unitsSold} sold</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(p.revenue / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
            {(topProducts.data?.length ?? 0) === 0 && (
              <li className="py-6 text-center text-sm text-slate-500">No sales data yet.</li>
            )}
          </ol>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Conversion funnel (30 days)</h2>
          <dl className="mt-4 space-y-3">
            <FunnelRow label="Conversations started" value={funnel.data?.conversations ?? 0} total={funnel.data?.conversations ?? 0} tone="bg-sky-500" />
            <FunnelRow label="Orders created" value={funnel.data?.ordersCreated ?? 0} total={funnel.data?.conversations ?? 1} tone="bg-indigo-500" hint={pct(funnel.data?.chatToOrderRate)} />
            <FunnelRow label="Orders paid" value={funnel.data?.ordersPaid ?? 0} total={funnel.data?.ordersCreated ?? 1} tone="bg-emerald-500" hint={pct(funnel.data?.checkoutCompletion)} />
          </dl>
        </Card>
      </section>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  total,
  tone,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
  hint?: string;
}) {
  const width = total > 0 ? Math.max(2, (value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <dt className="text-slate-600">{label}</dt>
        <dd className="font-semibold tabular-nums">
          {value}
          {hint && <span className="ml-2 text-xs font-normal text-slate-400">{hint}</span>}
        </dd>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function pct(value: number | null | undefined): string {
  return value == null ? '' : `${(value * 100).toFixed(1)}%`;
}
