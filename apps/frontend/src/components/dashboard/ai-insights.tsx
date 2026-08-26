'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Info,
  ArrowRight,
  X,
} from 'lucide-react';
import { Card, Spinner, EmptyState } from '../../components/ui';
import { cn } from '../../lib/utils/format';
import type { AIInsight } from '../../hooks/use-dashboard';

const TYPE_STYLES: Record<string, { bg: string; icon: string }> = {
  opportunity: {
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
  },
};

const TYPE_ICONS: Record<string, typeof TrendingUp> = {
  opportunity: TrendingUp,
  warning: AlertTriangle,
  info: Info,
};

interface AIInsightsProps {
  insights?: AIInsight[];
  isLoading: boolean;
}

export function AIInsights({ insights, isLoading }: AIInsightsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = (insights ?? []).filter((i) => !dismissed.has(i.id));

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Insights</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title="No insights right now"
            description="AI is analyzing your data. Check back soon."
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <AnimatePresence>
            {visible.map((insight) => {
              const styles = TYPE_STYLES[insight.type] ?? TYPE_STYLES.info;
              const Icon = TYPE_ICONS[insight.type] ?? Info;
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'relative overflow-hidden rounded-lg border p-3',
                    styles.bg,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {insight.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {insight.description}
                      </p>
                      <Link
                        href={insight.link}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {insight.action}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <button
                      onClick={() => setDismissed((prev) => new Set(prev).add(insight.id))}
                      className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600"
                      aria-label="Dismiss insight"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
