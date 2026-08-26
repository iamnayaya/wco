'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { Badge, Button, Card, EmptyState, Spinner } from '../../../components/ui';
import { formatMoney, formatRelativeTime } from '../../../lib/utils/format';

interface CustomerSummary {
  id: string;
  name: string;
  waPhone: string;
  segment: string | null;
  totalSpent: number;
  ordersCount: number;
  lastOrderAt: string | null;
  marketingOptIn: boolean;
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const customers = useQuery({
    queryKey: ['customers', search],
    queryFn: () =>
      api<{ items: CustomerSummary[]; nextCursor: string | null }>('/customers', {
        params: { search: search || undefined, limit: 50 },
      }),
    placeholderData: (prev) => prev,
  });

  const toggleOptIn = useMutation({
    mutationFn: ({ id, optIn }: { id: string; optIn: boolean }) =>
      api(`/customers/${id}/marketing-opt-in`, { method: 'PATCH', body: { optIn } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">Customers</h1>
        <div className="w-full sm:w-64">
          <input
            className="input"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {customers.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (customers.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No customers yet" description="Customers are created automatically when they message or order." />
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Segment</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Total spent</th>
                  <th className="px-4 py-3">Last order</th>
                  <th className="px-4 py-3">Marketing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.data?.items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{c.waPhone}</p>
                    </td>
                    <td className="px-4 py-3">{c.segment ? <Badge label={c.segment} /> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.ordersCount}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(c.totalSpent)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {c.lastOrderAt ? formatRelativeTime(c.lastOrderAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        className={`!px-2 !py-1 text-xs ${c.marketingOptIn ? '!text-emerald-600' : '!text-slate-400'}`}
                        disabled={toggleOptIn.isPending}
                        onClick={() => toggleOptIn.mutate({ id: c.id, optIn: !c.marketingOptIn })}
                      >
                        {c.marketingOptIn ? '✓ Opted in' : 'Not opted in'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
