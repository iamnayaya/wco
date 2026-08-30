'use client';

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils/format';

/** Small labeled value block used inside tab sections. */
export function Metric({ label, value, hint, icon }: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export function MetricGrid({ children, cols = 4, className }: {
  children: ReactNode;
  cols?: 2 | 3 | 4 | 6;
  className?: string;
}) {
  const colMap = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    6: 'sm:grid-cols-2 lg:grid-cols-6',
  };
  return (
    <div className={cn('grid grid-cols-2 gap-4', colMap[cols], className)}>{children}</div>
  );
}
