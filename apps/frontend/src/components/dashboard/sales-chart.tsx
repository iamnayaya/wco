'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../../components/ui';
import { formatMoney } from '../../lib/utils/format';
import { cn } from '../../lib/utils/format';
import type { DashboardMetrics } from '../../hooks/use-dashboard';

interface SalesChartProps {
  data?: DashboardMetrics;
}

const PERIODS = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
] as const;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
        {formatMoney(payload[0].value)}
      </p>
      {payload[1] && (
        <p className="text-xs text-slate-500">
          {payload[1].value} orders
        </p>
      )}
    </div>
  );
}

export function SalesChart({ data }: SalesChartProps) {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  const chartData = useMemo(() => {
    const timeseries = data?.timeseries ?? [];
    if (period === '7d') return timeseries.slice(-7);
    if (period === '30d') return timeseries.slice(-30);
    return timeseries;
  }, [data, period]);

  const totalRevenue = useMemo(
    () => chartData.reduce((sum, d) => sum + d.revenue, 0),
    [chartData],
  );

  const totalOrders = useMemo(
    () => chartData.reduce((sum, d) => sum + d.orders, 0),
    [chartData],
  );

  return (
    <Card className="col-span-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sales Overview</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {formatMoney(totalRevenue)} total · {totalOrders} orders
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                period === p.key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400">No sales data yet.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
