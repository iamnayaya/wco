'use client';

import { useMemo } from 'react';
import { Sparkles, X, ExternalLink, RefreshCw } from 'lucide-react';
import { Button, Card, EmptyState, Spinner } from '../../../components/ui';
import { INSIGHT_TYPE_LABEL, SEVERITY_LABEL } from '../helpers';
import { useActOnInsight, useDismissInsight, useGenerateInsights, useInsights } from '../hooks';
import type { InsightSeverity, InsightType } from '../types';
import { cn } from '../../../lib/utils/format';

const TYPE_STYLES: Record<InsightType, string> = {
  TREND: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ANOMALY: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  OPPORTUNITY: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  RISK: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  RECOMMENDATION: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

const SEVERITY_COLORS: Record<InsightSeverity, string> = {
  INFO: 'bg-slate-100 text-slate-600',
  LOW: 'bg-sky-100 text-sky-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const TYPE_ICONS: Record<InsightType, typeof Sparkles> = {
  TREND: Sparkles,
  ANOMALY: Sparkles,
  OPPORTUNITY: Sparkles,
  RISK: Sparkles,
  RECOMMENDATION: Sparkles,
};

export function InsightsSection({ from, to, canManage }: { from: string; to: string; canManage: boolean }) {
  const { data, isLoading } = useInsights({ status: 'ACTIVE', pageSize: 50 });
  const generate = useGenerateInsights();
  const dismiss = useDismissInsight();
  const act = useActOnInsight();

  const onGenerate = useMemo(() => () => {
    void generate.mutateAsync({ dateFrom: from, dateTo: to });
  }, [from, to, generate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Insights</h3>
          <p className="mt-0.5 text-xs text-slate-500">Automated patterns, anomalies and recommendations for the selected period.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onGenerate} loading={generate.isPending}>
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
            <Button variant="ghost" aria-label="Refresh insights">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !data?.items.length ? (
        <EmptyState
          title="No active insights"
          description="Generate insights to surface trends, anomalies and recommendations for this store."
          action={canManage ? (
            <Button onClick={onGenerate} loading={generate.isPending}>
              <Sparkles className="h-4 w-4" /> Generate insights
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((insight) => {
            const Icon = TYPE_ICONS[insight.insightType] ?? Sparkles;
            const actionLabel = insight.actionLabel;
            return (
              <Card key={insight.id} className="flex items-start gap-3">
                <span className={cn('mt-0.5 rounded-lg p-2', TYPE_STYLES[insight.insightType])}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{insight.title}</h4>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', SEVERITY_COLORS[insight.severity])}>
                      {SEVERITY_LABEL[insight.severity]}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {INSIGHT_TYPE_LABEL[insight.insightType]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{insight.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {insight.actionUrl && (
                      <a href={insight.actionUrl} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
                        {insight.actionLabel ?? 'View details'} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {canManage && (
                      <>
                        {actionLabel && insight.actionUrl && (
                          <Button variant="secondary" onClick={() => act.mutate({ id: insight.id, action: actionLabel })}>
                            Mark acted
                          </Button>
                        )}
                        <Button variant="ghost" aria-label="Dismiss insight" onClick={() => dismiss.mutate(insight.id)}>
                          <X className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
