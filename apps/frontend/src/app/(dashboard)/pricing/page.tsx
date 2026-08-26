'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { Badge, Button, Card, EmptyState, Spinner } from '../../../components/ui';
import { formatMoney, formatRelativeTime } from '../../../lib/utils/format';

interface Suggestion {
  id: string;
  productId: string;
  productName: string;
  currentPrice: number;
  suggestedPrice: number;
  rationale: string | null;
  confidence: number;
  status: string;
  expiresAt: string;
}

/** AI Pricing — approve/dismiss suggestions from the pricing-optimizer. */
export default function PricingPage() {
  const queryClient = useQueryClient();

  const suggestions = useQuery({
    queryKey: ['pricing-suggestions'],
    queryFn: () => api<{ items: Suggestion[] }>('/pricing/suggestions'),
    refetchInterval: 60_000,
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'dismiss' }) =>
      api(`/pricing/suggestions/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['pricing-suggestions'] }),
  });

  const optimize = useMutation({
    mutationFn: () => api('/pricing/optimize', { method: 'POST', body: {} }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">AI Pricing</h1>
          <p className="text-xs text-slate-500">
            Suggestions are capped at ±15% and never below cost +12% margin.
          </p>
        </div>
        <Button variant="secondary" loading={optimize.isPending} onClick={() => optimize.mutate()}>
          Run optimization
        </Button>
      </div>

      {suggestions.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (suggestions.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No pending suggestions"
          description="The optimizer runs nightly at 04:00 UTC — or trigger it manually above once you have sales history."
        />
      ) : (
        <ul className="space-y-2">
          {suggestions.data?.items.map((s) => {
            const deltaPct = ((s.suggestedPrice - s.currentPrice) / s.currentPrice) * 100;
            return (
              <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{s.productName}</p>
                  <p className="mt-0.5 text-sm">
                    <span className="text-slate-400 line-through tabular-nums">{formatMoney(s.currentPrice)}</span>
                    {' → '}
                    <span className={`font-bold tabular-nums ${deltaPct >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {formatMoney(s.suggestedPrice)}
                    </span>
                    <span className={`ml-2 text-xs font-semibold ${deltaPct >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                      {deltaPct >= 0 ? '+' : ''}
                      {deltaPct.toFixed(1)}%
                    </span>
                    <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                      {Math.round(s.confidence * 100)}% conf
                    </span>
                  </p>
                  {s.rationale && (
                    <p className="mt-1 max-w-xl truncate text-xs italic text-slate-500">{s.rationale}</p>
                  )}
                  <p className="mt-1 text-[10px] text-slate-400">Expires {formatRelativeTime(s.expiresAt)}</p>
                </div>
                {s.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <Button loading={act.isPending} onClick={() => act.mutate({ id: s.id, action: 'approve' })}>
                      Apply
                    </Button>
                    <Button variant="secondary" onClick={() => act.mutate({ id: s.id, action: 'dismiss' })}>
                      Dismiss
                    </Button>
                  </div>
                ) : (
                  <Badge label={s.status} tone={s.status === 'APPROVED' ? 'PAID' : 'REFUNDED'} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
