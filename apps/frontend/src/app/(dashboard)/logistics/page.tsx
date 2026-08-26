'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { Badge, Button, Card, EmptyState, Spinner } from '../../../components/ui';
import { formatMoney, formatRelativeTime } from '../../../lib/utils/format';

interface ShipmentSummary {
  id: string;
  orderId: string;
  carrier: string | null;
  trackingCode: string | null;
  status: string;
  fee: number | null;
  etaMinutes: number | null;
  bookedAt: string | null;
  createdAt: string;
}

export default function LogisticsPage() {
  const queryClient = useQueryClient();

  const shipments = useQuery({
    queryKey: ['shipments'],
    queryFn: () => api<{ items: ShipmentSummary[] }>('/logistics/shipments'),
    refetchInterval: 30_000,
  });

  const track = useMutation({
    mutationFn: (shipmentId: string) =>
      api<{ status: string; events: Array<{ label: string; at: string }> }>(`/logistics/shipments/${shipmentId}/track`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Deliveries</h1>

      {shipments.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (shipments.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No deliveries yet"
          description="Get instant quotes from GIG, Kwik and Sendy on paid orders — book the cheapest in one tap."
        />
      ) : (
        <ul className="space-y-2">
          {shipments.data?.items.map((s) => {
            const tracking = s.trackingCode ? track.data : undefined;
            return (
              <li key={s.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Order shipment{' '}
                      <span className="font-mono text-xs text-slate-500">{s.id.slice(0, 8)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {s.carrier ?? 'Not booked'}
                      {s.fee !== null && ` · ${formatMoney(s.fee)}`}
                      {s.etaMinutes !== null && ` · ETA ${s.etaMinutes} min`}
                      {` · ${formatRelativeTime(s.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      label={s.status}
                      tone={
                        s.status === 'DELIVERED' ? 'PAID' : s.status === 'FAILED' || s.status === 'CANCELLED' ? 'CANCELLED' : 'PROCESSING'
                      }
                    />
                    {s.trackingCode && (
                      <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => track.mutate(s.id)}>
                        Track
                      </Button>
                    )}
                  </div>
                </div>
                {tracking && tracking.events.length > 0 && (
                  <ol className="border-t border-slate-100 pt-2 text-xs text-slate-600">
                    {tracking.events.map((event, i) => (
                      <li key={i} className="flex justify-between py-0.5">
                        <span>{event.label}</span>
                        <span className="text-slate-400">{formatRelativeTime(event.at)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
