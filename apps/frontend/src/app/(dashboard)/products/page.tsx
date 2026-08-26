'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { Badge, Button, Card, EmptyState, Field, Input, Spinner } from '../../../components/ui';
import { formatMoney } from '../../../lib/utils/format';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  status: string;
  category: string | null;
}

const emptyForm = { name: '', sku: '', price: '', stockQuantity: '0', category: '' };

export default function ProductsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => api<{ items: Product[]; nextCursor: string | null }>('/products', { params: { limit: 50 } }),
  });

  const createProduct = useMutation({
    mutationFn: (body: typeof form) =>
      api<{ id: string }>('/products', {
        method: 'POST',
        body: {
          name: body.name,
          sku: body.sku || undefined,
          price: Number(body.price),
          stockQuantity: Number(body.stockQuantity),
          category: body.category || undefined,
        },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Products</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add product'}</Button>
      </div>

      {showForm && (
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createProduct.mutate(form);
            }}
          >
            <Field label="Name" error={createProduct.error?.message}>
              <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="SKU (optional)">
              <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </Field>
            <Field label="Price">
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </Field>
            <Field label="Stock quantity">
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.stockQuantity}
                onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
              />
            </Field>
            <Field label="Category (optional)">
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </Field>
            <div className="flex items-end">
              <Button type="submit" loading={createProduct.isPending}>Save product</Button>
            </div>
          </form>
        </Card>
      )}

      {products.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (products.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No products yet" description="Add your first product — the AI will start suggesting prices after a few sales." />
      ) : (
        <ul className="space-y-2">
          {products.data?.items.map((p) => (
            <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">
                  SKU {p.sku}{p.category ? ` · ${p.category}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold tabular-nums">{formatMoney(p.price)}</span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    p.stockQuantity <= p.lowStockThreshold ? 'text-orange-600' : 'text-slate-500'
                  }`}
                >
                  {p.stockQuantity} in stock
                </span>
                <Badge label={p.status === 'ACTIVE' ? 'ACTIVE' : p.status} tone={p.status === 'ACTIVE' ? 'PAID' : 'REFUNDED'} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
