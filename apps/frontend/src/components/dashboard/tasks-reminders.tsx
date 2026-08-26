'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Clock,
  AlertTriangle,
  Package,
  CreditCard,
  Truck,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Card, Spinner, EmptyState } from '../../components/ui';
import { cn } from '../../lib/utils/format';
import type { DashboardTask } from '../../hooks/use-dashboard';

const TYPE_ICONS: Record<string, typeof Clock> = {
  pending_order: Clock,
  low_stock: Package,
  payment_overdue: CreditCard,
  delivery_pending: Truck,
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  low: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

interface TasksRemindersProps {
  tasks?: DashboardTask[];
  isLoading: boolean;
}

export function TasksReminders({ tasks, isLoading }: TasksRemindersProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = (tasks ?? []).filter((t) => !dismissed.has(t.id));

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Tasks & Reminders
        </h3>
        {visible.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {visible.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title="All clear!"
            description="No pending tasks or reminders."
            action={<CheckCircle2 className="h-8 w-8 text-emerald-400" />}
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {visible.map((task) => {
            const Icon = TYPE_ICONS[task.type] ?? AlertTriangle;
            return (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', PRIORITY_STYLES[task.priority])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={task.link} className="text-sm font-medium text-slate-900 hover:underline dark:text-white">
                    {task.title}
                  </Link>
                  {task.dueDate && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(task.id))}
                  className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Dismiss task"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
