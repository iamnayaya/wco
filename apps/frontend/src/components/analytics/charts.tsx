'use client';

import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../../components/ui';
import { cn } from '../../lib/utils/format';
import { money, shortAxis } from './helpers';

/**
 * Minimal, reusable Recharts wrappers — consistent theming, empty states,
 * and a shared accessibility role. All are intentionally thin so callers
 * control data shape while presentation stays uniform.
 */

const GRID = '#e2e8f0';
const AXIS = { fontSize: 11, fill: '#94a3b8' };
const PALETTE = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#f43f5e'];
const RADIAN = Math.PI / 180;

function ChartCard({ title, subtitle, action, children, className }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Empty({ span }: { span?: number }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center">
      <p className="text-sm text-slate-400 dark:text-slate-500">No data in this range.</p>
    </div>
  );
}

function DefaultTooltip({ active, payload, label, valuePrefix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800">
      {label != null && <p className="mb-1 font-medium text-slate-500 dark:text-slate-400">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="font-semibold text-slate-900 dark:text-white">
          <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: entry.color || entry.payload?.fill }} />
          {entry.name}: {valuePrefix ? valuePrefix(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

interface SeriesProps {
  title: string;
  subtitle?: string;
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: Array<{ key: string; name: string; color?: string }>;
  height?: number;
  moneyValues?: string[];
  className?: string;
}

export function LineTrend({ title, subtitle, data, xKey, series, height = 260, moneyValues = [], className }: SeriesProps) {
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <div style={{ height }} role="img" aria-label={title}>
        {data.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v, i) => shortAxis(String(v), data.length)} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip content={<DefaultTooltip valuePrefix={(v: number) => (moneyValues.length ? money(v) : v)} />} />
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

export function AreaTrend(props: SeriesProps) {
  const { title, subtitle, data, xKey, series, height = 260, moneyValues = [], className } = props;
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <div style={{ height }} role="img" aria-label={title}>
        {data.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color ?? PALETTE[i % PALETTE.length]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={s.color ?? PALETTE[i % PALETTE.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v, i) => shortAxis(String(v), data.length)} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip content={<DefaultTooltip valuePrefix={(v: number) => (moneyValues.length ? money(v) : v)} />} />
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  fill={`url(#grad-${s.key})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

export function BarCompare({ title, subtitle, data, xKey, series, height = 260, moneyValues = [], className }: SeriesProps) {
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <div style={{ height }} role="img" aria-label={title}>
        {data.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip content={<DefaultTooltip valuePrefix={(v: number) => (moneyValues.length ? money(v) : v)} />} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color ?? PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

interface PieProps {
  title: string;
  subtitle?: string;
  data: Array<{ name: string; value: number }>;
  height?: number;
  unit?: string;
  className?: string;
}

export function PieDist({ title, subtitle, data, height = 260, unit = '', className }: PieProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <div style={{ height }} role="img" aria-label={title}>
        {data.length === 0 ? <Empty /> : (
          <div className="flex h-full items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip content={<DefaultTooltip valuePrefix={(v: number) => `${v}${unit}`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="min-w-0 flex-1 space-y-1.5">
              {data.map((d, i) => {
                const pct = total > 0 ? (d.value / total) * 100 : 0;
                return (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-400">{d.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

export function Gauge({ title, value, max = 100, suffix = '%', className }: { title: string; value: number; max?: number; suffix?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <Card className={cn('flex flex-col items-center justify-center py-6', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="relative mt-3 h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke="#10b981"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{Math.round(value)}{suffix}</span>
        </div>
      </div>
    </Card>
  );
}

/** Activity heatmap (by hour/day) rendered as a compact grid. */
export function Heatmap({ title, rows, colLabels, className }: {
  title: string;
  rows: number[][]; // rows[hourDay... ]; each inner array is a day series
  colLabels: string[];
  className?: string;
}) {
  const max = Math.max(1, ...rows.flat());
  return (
    <ChartCard title={title} className={className}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[520px]" style={{ gridTemplateColumns: `2.5rem repeat(${colLabels.length}, minmax(0,1fr))` }} aria-label={title}>
          {rows.map((row, ri) => (
            <>
              {colLabels.map((_, ci) => (
                <div
                  key={`${ri}-${ci}`}
                  className="m-0.5 aspect-square rounded-sm"
                  style={{ background: `rgba(16,185,129,${(rows[ri][ci] / max).toFixed(2)})` }}
                  title={`${ri}:00 · ${colLabels[ci]} · ${rows[ri][ci]}`}
                />
              ))}
            </>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
