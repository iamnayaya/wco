'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../store/slices/auth-slice';
import { Badge, Button, Card, EmptyState, Field, Input, Spinner } from '../../../components/ui';

interface Store {
  id: string;
  name: string;
  slug: string;
  whatsappNumber: string | null;
  currency: string;
  status: string;
  _count?: { products: number; orders: number; customers: number };
}

export default function StoresPage() {
  const queryClient = useQueryClient();
  const setActiveStore = useAuthStore((s) => s.setActiveStore);
  const [form, setForm] = useState({ name: '', slug: '', currency: 'NGN' });
  const [whatsappTarget, setWhatsappTarget] = useState<{ storeId: string; value: string } | null>(null);

  const stores = useQuery({ queryKey: ['stores'], queryFn: () => api<Store[]>('/stores') });

  const createStore = useMutation({
    mutationFn: () =>
      api('/stores', { method: 'POST', body: form, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stores'] });
      setForm({ name: '', slug: '', currency: 'NGN' });
    },
  });

  const connectWhatsapp = useMutation({
    mutationFn: (input: { storeId: string; phoneNumber: string }) =>
      api(`/stores/${input.storeId}/whatsapp`, {
        method: 'POST',
        body: { phoneNumber: input.phoneNumber },
        idempotencyKey: input.storeId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stores'] });
      setWhatsappTarget(null);
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Stores</h1>

      {stores.isLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner /></div>
      ) : (
        <>
          <ul className="space-y-2">
            {(stores.data ?? []).map((store) => (
              <li key={store.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{store.name}</p>
                  <p className="text-xs text-slate-500">
                    /{store.slug} · {store.currency}
                    {store.whatsappNumber && ` · WhatsApp ${store.whatsappNumber}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge label={store.status === 'ACTIVE' ? 'ACTIVE' : store.status} tone={store.status === 'ACTIVE' ? 'PAID' : 'PENDING_PAYMENT'} />
                  {!store.whatsappNumber && (
                    <Button
                      variant="secondary"
                      onClick={() => setWhatsappTarget({ storeId: store.id, value: '' })}
                    >
                      Connect WhatsApp
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setActiveStore(store.id)}>
                    Switch to
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {whatsappTarget && connectWhatsapp.error && (
            <Card className="border-red-200 bg-red-50 text-sm text-red-700">
              {connectWhatsapp.error.message} — the number may already be connected to another WCO account.
            </Card>
          )}

          <Card>
            <form
              className="grid gap-3 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                createStore.mutate();
              }}
            >
              <Field label="Store name" error={createStore.error?.message}>
                <Input
                  required
                  placeholder="Ada's Fabrics"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value,
                      slug: e.target.value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
                    }))
                  }
                />
              </Field>
              <Field label="URL slug">
                <Input required placeholder="adas-fabrics" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              </Field>
              <Field label="Currency">
                <select className="input" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                  <option>NGN</option>
                  <option>GHS</option>
                  <option>KES</option>
                  <option>ZAR</option>
                  <option>USD</option>
                </select>
              </Field>
              <div className="sm:col-span-3">
                <Button type="submit" loading={createStore.isPending}>Create store</Button>
              </div>
            </form>
          </Card>

          {whatsappTarget && (
            <Card>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  connectWhatsapp.mutate({
                    storeId: whatsappTarget.storeId,
                    phoneNumber: whatsappTarget.value,
                  });
                }}
              >
                <Field label="WhatsApp Business number">
                  <Input
                    required
                    type="tel"
                    placeholder="+2348012345678"
                    value={whatsappTarget.value}
                    onChange={(e) => setWhatsappTarget({ ...whatsappTarget, value: e.target.value })}
                  />
                </Field>
                <Button type="submit" loading={connectWhatsapp.isPending}>Connect number</Button>
              </form>
            </Card>
          )}

          {(stores.data?.length ?? 0) === 0 && (
            <EmptyState title="No stores yet" description="Create your first store above — you can run multiple storefronts from one login." />
          )}
        </>
      )}
    </div>
  );
}
