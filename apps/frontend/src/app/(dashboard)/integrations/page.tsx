'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api/client';
import { Badge, Button, Card, Input, Spinner } from '../../../components/ui';

interface Subscription {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

/** Integrations — WhatsApp status + merchant outbound webhooks. */
export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ url: '', events: 'order.paid,message.received' });
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const eventTypes = useQuery({
    queryKey: ['webhook-event-types'],
    queryFn: () => api<{ events: string[] }>('/webhooks/event-types'),
    staleTime: Infinity,
  });
  const subscriptions = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api<Subscription[]>('/webhooks'),
  });

  const createWebhook = useMutation({
    mutationFn: () =>
      api<{ secret: string }>('/webhooks', {
        method: 'POST',
        body: { url: form.url, events: form.events.split(',').map((e) => e.trim()).filter(Boolean) },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (data) => {
      setCreatedSecret(data.secret);
      void queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setForm({ url: '', events: 'order.paid,message.received' });
    },
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api(`/webhooks/${id}/toggle`, { method: 'PATCH' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-900">Integrations</h1>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Outbound webhooks</h2>
        <p className="mt-1 text-xs text-slate-500">
          Get notified when things happen in your store — payments received, orders placed, messages needing you.
        </p>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            createWebhook.mutate();
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">HTTPS endpoint</span>
            <Input
              required
              type="url"
              placeholder="https://yourapp.com/hooks/wco"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Events (comma-separated)</span>
            <Input value={form.events} onChange={(e) => setForm((f) => ({ ...f, events: e.target.value }))} />
          </label>
          <div className="flex items-end">
            <Button type="submit" loading={createWebhook.isPending}>Add</Button>
          </div>
        </form>
        {createWebhook.error && (
          <p className="mt-2 text-xs font-medium text-red-600">{createWebhook.error.message}</p>
        )}

        {createdSecret && (
          <Card className="mt-3 border-emerald-200 bg-emerald-50">
            <p className="text-xs font-semibold text-emerald-800">Signing secret (shown once — copy now):</p>
            <code className="mt-1 block break-all rounded bg-white px-2 py-1.5 font-mono text-xs text-emerald-900">
              {createdSecret}
            </code>
          </Card>
        )}

        {subscriptions.isLoading ? (
          <div className="flex h-20 items-center justify-center"><Spinner /></div>
        ) : (
          <ul className="mt-4 space-y-2">
            {(subscriptions.data ?? []).map((sub) => (
              <li key={sub.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-slate-700">{sub.url}</p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-400">{sub.events.join(', ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={sub.isActive ? 'ACTIVE' : 'PAUSED'} tone={sub.isActive ? 'PAID' : 'REFUNDED'} />
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => toggle.mutate(sub.id)}>
                    {sub.isActive ? 'Pause' : 'Resume'}
                  </Button>
                  <Button variant="ghost" className="!px-2 !py-1 text-xs !text-red-600" onClick={() => remove.mutate(sub.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
            {(subscriptions.data?.length ?? 0) === 0 && (
              <li className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                No webhooks configured yet.
              </li>
            )}
          </ul>
        )}

        {eventTypes.data && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">Available events</summary>
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-400">{eventTypes.data.events.join(' · ')}</p>
          </details>
        )}
      </Card>
    </div>
  );
}
