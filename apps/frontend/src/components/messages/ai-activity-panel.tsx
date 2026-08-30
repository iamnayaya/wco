'use client';

import { EmptyState } from '../../components/ui';
import { useMessageStats } from './hooks';

/**
 * AI activity summary — a compact readout of bot performance and the
 * escalation queue. Reads from GET /messages/stats (60s Redis-cached).
 */
export function AiActivityPanel() {
  const { data: stats, isLoading } = useMessageStats();

  if (isLoading || !stats) {
    return <EmptyState title="Loading activity…" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AI replies</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{stats.botReplies}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resolution rate</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {(stats.aiResolutionRate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avg latency</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {(stats.avgResponseLatencyMs / 1000).toFixed(1)}s
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open escalations</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{stats.openEscalations}</p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">Top intents</p>
        {stats.topIntents.length === 0 ? (
          <p className="text-xs text-slate-400">No classified intents yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {stats.topIntents.map((t) => (
              <li key={t.intent} className="flex items-center gap-2">
                <span className="text-xs text-slate-600">{t.intent.replaceAll('_', ' ')}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (t.count / Math.max(1, stats.topIntents[0].count)) * 100)}%` }}
                  />
                </span>
                <span className="text-xs tabular-nums text-slate-500">{t.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">Volume</p>
        <div className="flex items-end gap-1">
          {stats.messagesByDay.slice(-14).map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5" title={`${d.date}: ${d.count}`}>
              <span className="text-[9px] tabular-nums text-slate-400">{d.count}</span>
              <span
                className="w-full rounded-t bg-emerald-500"
                style={{ height: `${Math.max(3, (d.count / Math.max(1, ...stats.messagesByDay.map((x) => x.count))) * 40)}px` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
