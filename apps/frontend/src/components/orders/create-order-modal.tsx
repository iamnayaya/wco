'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiEnvelope } from '../../lib/api/client';
import { Button, Card, Field, Input, Textarea } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import { useCreateOrder } from './hooks';
import { formatOrderMoney } from './helpers';
import { toNumber } from './types';

interface Product {
  id: string;
  name: string;
  sku?: string | null;
  price: string | number;
  stockQuantity?: number;
  variants?: Array<{ id: string; name: string; price: string | number }>;
}

interface CustomerSummary {
  id: string;
  name: string | null;
  waPhone: string;
}

interface LineItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
}

interface CreateOrderModalProps {
  onClose: () => void;
  onDone: () => void;
}

export function CreateOrderModal({ onClose, onDone }: CreateOrderModalProps) {
  const [lines, setLines] = useState<LineItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [channel, setChannel] = useState<'DASHBOARD' | 'WHATSAPP' | 'PAYMENT_LINK'>('DASHBOARD');
  const [discount, setDiscount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [pick, setPick] = useState<{ productId: string; variantId?: string }>({ productId: '' });
  const createOrder = useCreateOrder();

  const products = useQuery({
    queryKey: ['products', 'picker'],
    queryFn: () =>
      api<ApiEnvelope<{ items: Product[]; nextCursor: string | null }>>('/products', { params: { limit: 100 } }),
  });

  const customers = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: () =>
      api<ApiEnvelope<{ items: CustomerSummary[]; nextCursor: string | null }>>('/customers', { params: { limit: 100 } }),
  });

  const productList = products.data?.data?.items ?? [];
  const customerList = customers.data?.data?.items ?? [];

  const selectedProduct = productList.find((p) => p.id === pick.productId);
  const selectedVariant = selectedProduct?.variants?.find((v) => v.id === pick.variantId);
  const unitPrice = toNumber(selectedVariant?.price ?? selectedProduct?.price ?? 0);

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = Math.max(0, subtotal - toNumber(discount) + toNumber(deliveryFee));

  function addLine() {
    if (!selectedProduct) return;
    const existing = lines.find((l) => l.productId === selectedProduct.id && l.variantId === pick.variantId);
    if (existing) {
      setLines((ls) => ls.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l)));
    } else {
      setLines((ls) => [
        ...ls,
        {
          productId: selectedProduct.id,
          variantId: pick.variantId,
          productName: selectedProduct.name,
          variantName: selectedVariant?.name,
          quantity: 1,
          unitPrice,
        },
      ]);
    }
    setPick({ productId: '' });
  }

  function submit() {
    if (lines.length === 0 || createOrder.isPending) return;
    createOrder.mutate(
      {
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
        customerId: customerId || undefined,
        customerPhone: !customerId ? customerPhone || undefined : undefined,
        channel,
        discount: discount ? toNumber(discount) : undefined,
        deliveryFee: deliveryFee ? toNumber(deliveryFee) : undefined,
        notes: notes.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryCity: deliveryCity.trim() || undefined,
      },
      { onSuccess: () => onDone() },
    );
  }

  return (
    <Modal open onClose={onClose} title="Create order" size="lg">
      <div className="space-y-4">
        {/* Line items */}
        <Field label="Add products">
          <div className="flex gap-2">
            <select
              className="input flex-1"
              value={pick.productId}
              onChange={(e) => setPick({ productId: e.target.value })}
              aria-label="Select product"
            >
              <option value="">Select a product…</option>
              {productList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ''} — {formatOrderMoney(toNumber(p.price))}
                </option>
              ))}
            </select>
            {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0 && (
              <select
                className="input"
                value={pick.variantId ?? ''}
                onChange={(e) => setPick({ ...pick, variantId: e.target.value || undefined })}
                aria-label="Select variant"
              >
                <option value="">Default variant</option>
                {selectedProduct.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {formatOrderMoney(toNumber(v.price))}
                  </option>
                ))}
              </select>
            )}
            <Button type="button" variant="secondary" disabled={!selectedProduct} onClick={addLine}>
              Add
            </Button>
          </div>
        </Field>

        {lines.length > 0 ? (
          <Card className="space-y-2 p-3">
            {lines.map((l) => (
              <div key={`${l.productId}-${l.variantId ?? ''}`} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{l.productName}{l.variantName ? ` · ${l.variantName}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="!h-7 !w-7 !p-0 text-xs"
                    aria-label="Decrease quantity"
                    disabled={l.quantity <= 1}
                    onClick={() => setLines((ls) => ls.map((x) => (x === l ? { ...x, quantity: x.quantity - 1 } : x)))}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center tabular-nums">{l.quantity}</span>
                  <Button
                    variant="secondary"
                    className="!h-7 !w-7 !p-0 text-xs"
                    aria-label="Increase quantity"
                    onClick={() => setLines((ls) => ls.map((x) => (x === l ? { ...x, quantity: x.quantity + 1 } : x)))}
                  >
                    +
                  </Button>
                  <span className="w-20 text-right tabular-nums">{formatOrderMoney(l.unitPrice * l.quantity)}</span>
                  <Button variant="ghost" className="!p-1 text-xs" aria-label="Remove item" onClick={() => setLines((ls) => ls.filter((x) => x !== l))}>
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <p className="text-sm text-slate-500">No items added yet.</p>
        )}

        {/* Customer */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Existing customer">
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Select customer">
              <option value="">No existing customer</option>
              {customerList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Unknown'} ({c.waPhone})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Or phone for new customer">
            <Input
              disabled={Boolean(customerId)}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+234…"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Channel">
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
              <option value="DASHBOARD">Dashboard</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PAYMENT_LINK">Payment link</option>
            </select>
          </Field>
          <Field label="Discount">
            <Input type="number" min="0" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Delivery fee">
            <Input type="number" min="0" inputMode="decimal" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="0" />
          </Field>
        </div>

        <Field label="Delivery address">
          <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Street, area" />
        </Field>
        <Field label="Delivery city">
          <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} placeholder="Lagos" />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order context for the team (optional)" />
        </Field>

        <div className="flex items-center justify-end gap-4 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">
            Total: <span className="text-lg font-bold text-slate-900">{formatOrderMoney(total)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button loading={createOrder.isPending} disabled={lines.length === 0} onClick={submit}>
              Create order
            </Button>
          </div>
        </div>

        {createOrder.error && (
          <p className="text-sm text-red-600">{createOrder.error instanceof Error ? createOrder.error.message : 'Failed to create order'}</p>
        )}
      </div>
    </Modal>
  );
}
