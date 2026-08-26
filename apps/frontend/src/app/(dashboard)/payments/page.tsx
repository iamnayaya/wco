'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { Badge, Card, EmptyState, Spinner, StatCard } from '../../../components/ui';
import { formatMoney, formatRelativeTime } from '../../../lib/utils/format';

interface PaymentSummary {
  id: string;
  provider: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function PaymentsPage() {
  const providers = useQuery({
    queryKey: ['payments', 'providers'],
    queryFn: () => api<Array<{ name: string; configured: boolean; currencies: string[] }>>('/payments/providers'),
  });
  const payments = useQuery({
    queryKey: ['payments'],
    queryFn: () => api<{ items: PaymentSummary[]; nextCursor: string | null }>('/payments', { params: { limit: 20 } }),
    refetchInterval: 30_000,
  });

  const paid = (payments.data?.items ?? []).filter((p) => p.status === 'SUCCEEDED');
  const settledToday = paid
    .filter((p) => new Date(p.createdAt).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Payments</h1>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Settled today" value={formatMoney(settledToday)} />
        <StatCard label="Successful all-time" value={String(paid.length)} />
        <StatCard
          label="Pending"
          value={String((payments.data?.items ?? []).filter((p) => p.status === 'INITIALIZED').length)}
        />
        <StatCard
          label="Providers live"
          value={`${(providers.data ?? []).filter((p) => p.configured).length}/${providers.data?.length ?? 0}`}
        />
      </section>

      {payments.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Payment providers</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(providers.data ?? []).map((provider) => (
                <Card key={provider.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{provider.name}</span>
                  <Badge label={provider.configured ? 'LIVE' : 'NOT SET UP'} tone={provider.configured ? 'PAID' : 'REFUNDED'} />
                </Card>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Connect API keys in Settings → Integrations. Paystack first — best coverage in Nigeria & Ghana.
            </p>
          </section>

          {(payments.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No payments yet" description="Payment links you share will show their status here in real time." />
          ) : (
            <ul className="space-y-2">
              {payments.data?.items.map((payment) => (
                <li key={payment.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{payment.reference}</p>
                    <p className="text-xs text-slate-400">{formatRelativeTime(payment.createdAt)} · {payment.provider}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold tabular-nums">{formatMoney(payment.amount, payment.currency)}</span>
                    <Badge label={payment.status} tone={payment.status === 'SUCCEEDED' ? 'PAID' : payment.status === 'FAILED' ? 'CANCELLED' : 'PENDING_PAYMENT'} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
