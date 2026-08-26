'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { Badge, Button, Card, EmptyState, Field, Input, Spinner, Textarea } from '../../../components/ui';
import { formatRelativeTime } from '../../../lib/utils/format';

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  audienceCount: number | null;
  sentCount: number;
  scheduledAt: string | null;
  createdAt: string;
}

const emptyForm = { name: '', message: '', scheduledAt: '' };

export default function MarketingPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<{ items: Campaign[] }>('/marketing/campaigns'),
    refetchInterval: 30_000,
  });

  const createCampaign = useMutation({
    mutationFn: () =>
      api('/marketing/campaigns', {
        method: 'POST',
        body: {
          name: form.name,
          message: form.message,
          scheduledAt: form.scheduledAt || undefined,
        },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setForm(emptyForm);
    },
  });

  const launch = useMutation({
    mutationFn: (id: string) => api(`/marketing/campaigns/${id}/launch`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Marketing</h1>

      <Card>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createCampaign.mutate();
          }}
        >
          <p className="text-sm font-semibold text-slate-700">New campaign</p>
          <Field label="Name" error={createCampaign.error?.message}>
            <Input required placeholder="Black Friday blast" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Message" error={createCampaign.error?.message}>
            <Textarea
              required
              rows={3}
              maxLength={300}
              placeholder="🔥 Weekend deal! 20% off everything. Reply BUY to order."
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Schedule (optional)">
              <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
            </Field>
            <Button type="submit" loading={createCampaign.isPending}>Save campaign</Button>
          </div>
        </form>
      </Card>

      {campaigns.isLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner /></div>
      ) : (campaigns.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No campaigns yet" description="Only customers who opted in to marketing receive broadcasts — GDPR-safe by default." />
      ) : (
        <ul className="space-y-2">
          {campaigns.data?.items.map((c) => (
            <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                <p className="mt-0.5 truncate text-sm text-slate-600">{c.message}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {c.scheduledAt ? `Scheduled ${formatRelativeTime(c.scheduledAt)}` : formatRelativeTime(c.createdAt)}
                  {c.sentCount > 0 && ` · ${c.sentCount} sent`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge label={c.status} tone={c.status === 'RUNNING' || c.status === 'COMPLETED' ? 'PAID' : c.status === 'FAILED' ? 'CANCELLED' : 'PROCESSING'} />
                {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                  <Button variant="secondary" loading={launch.isPending} onClick={() => launch.mutate(c.id)} disabled={!c.audienceCount}>
                    Launch{typeof c.audienceCount === 'number' ? ` (${c.audienceCount})` : ''}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
