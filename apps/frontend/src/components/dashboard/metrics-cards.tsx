'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  MessageSquare,
  Package,
  BarChart3,
} from 'lucide-react';
import { cn } from '../../lib/utils/format';
import { formatMoney, formatPercent } from '../../lib/utils/format';
import { fadeUp } from '../../lib/utils/animations';
import type { DashboardMetrics } from '../../hooks/use-dashboard';

interface MetricCardProps {
  label: string;
  value: string;
  delta?: number | null;
  icon: typeof DollarSign;
  href: string;
  color: string;
}

function MetricCard({ label, value, delta, icon: Icon, href, color }: MetricCardProps) {
  const isPositive = delta !== null && delta !== undefined && delta >= 0;
  const isNegative = delta !== null && delta !== undefined && delta < 0;

  return (
    <Link href={href}>
      <motion.div
        variants={fadeUp}
        className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {value}
            </p>
            {delta !== null && delta !== undefined && (
              <div className="mt-1 flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : isNegative ? (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                ) : null}
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    isPositive && 'text-emerald-600 dark:text-emerald-400',
                    isNegative && 'text-red-600 dark:text-red-400',
                    !isPositive && !isNegative && 'text-slate-500',
                  )}
                >
                  {formatPercent(delta)}
                </span>
                <span className="text-xs text-slate-400">vs yesterday</span>
              </div>
            )}
          </div>
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

interface MetricsCardsProps {
  data?: DashboardMetrics;
}

export function MetricsCards({ data }: MetricsCardsProps) {
  const cards: MetricCardProps[] = [
    {
      label: 'Revenue Today',
      value: formatMoney(data?.today.revenue ?? 0),
      delta: data?.vsYesterday.revenueDeltaPct,
      icon: DollarSign,
      href: '/analytics',
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    },
    {
      label: 'Orders Today',
      value: String(data?.today.orders ?? 0),
      delta: data?.vsYesterday.ordersDeltaPct,
      icon: ShoppingCart,
      href: '/orders',
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    },
    {
      label: 'Customers',
      value: String(data?.week.customers ?? 0),
      delta: data?.vsYesterday.customersDeltaPct,
      icon: Users,
      href: '/customers',
      color: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    },
    {
      label: 'Unread Messages',
      value: String(data?.today.unreadMessages ?? 0),
      delta: null,
      icon: MessageSquare,
      href: '/conversations',
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    },
    {
      label: 'AI Resolution',
      value: `${Math.round((data?.week.aiResolutionRate ?? 0) * 100)}%`,
      delta: null,
      icon: BarChart3,
      href: '/analytics',
      color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
    },
    {
      label: 'Month Revenue',
      value: formatMoney(data?.month.revenue ?? 0),
      delta: data?.month.growth ?? null,
      icon: Package,
      href: '/analytics',
      color: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
    },
  ];

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </motion.div>
  );
}
