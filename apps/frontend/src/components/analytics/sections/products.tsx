'use client';

import { BarCompare, PieDist } from '../charts';
import { Metric, MetricGrid } from '../metrics';
import { money } from '../helpers';
import { useProductMetrics, useTopProducts } from '../hooks';

export function ProductsSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading, isError } = useProductMetrics({ from, to });
  const top = useTopProducts(30, 10);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading product metrics…</p>;
  }
  if (isError || !data) {
    return <p className="py-16 text-center text-sm text-red-500">Could not load product metrics.</p>;
  }

  const stock = (data.stockByStatus ?? []).map((s) => ({ name: s.status, value: s._count }));
  const category = (data.categoryBreakdown ?? []).map((c) => ({
    name: c.category ?? 'Uncategorized',
    revenue: Number(c.revenue) || 0,
  }));

  return (
    <div className="space-y-6">
      <MetricGrid>
        <Metric label="Total products" value={String(data.totalProducts ?? 0)} />
        <Metric label="Inventory turnover" value={Number(data.inventoryTurnover ?? 0).toFixed(2)} />
      </MetricGrid>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top selling products</h3>
          <span className="text-xs text-slate-400">by quantity (30 days)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 text-right font-medium">Qty sold</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(top.data ?? []).map((row, i) => (
                <tr key={row.productId ?? i} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                    {i + 1}. {row.productId}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">{row.quantitySold}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-white">{money(row.revenue)}</td>
                </tr>
              ))}
              {!top.data?.length && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No product sales in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PieDist title="Stock by status" data={stock} />
        <BarCompare
          title="Revenue by category"
          data={category}
          xKey="name"
          series={[{ key: 'revenue', name: 'Revenue' }]}
          moneyValues={['revenue']}
        />
      </div>
    </div>
  );
}
