'use client';

import { useState } from 'react';
import { Badge, Button, Spinner } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import { formatRelativeTime } from '../../lib/utils/format';
import { useOrderDetail, useOrderNotes, useOrderTimeline, useCheckFraud, usePredictFulfillment, useCreateNote } from './hooks';
import { channelLabel, formatOrderMoney, fraudLevelLabel, FRAUD_LEVEL_TONE, formatDuration } from './helpers';
import type { FraudVerdict, TimelineEvent } from './types';
import { toNumber } from './types';
import { RefundModal } from './refund-modal';
import { CancelDialog } from './cancel-dialog';
import { OrderStatusModal } from './order-status-modal';

interface OrderDetailModalProps {
  orderId: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  isOwnerAdmin?: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function OrderDetailModal({
  orderId,
  orderNumber,
  customerName,
  customerPhone,
  isOwnerAdmin = false,
  onClose,
  onChanged,
}: OrderDetailModalProps) {
  const detail = useOrderDetail(orderId);
  const notesQ = useOrderNotes(orderId);
  const timelineQ = useOrderTimeline(orderId);
  const checkFraud = useCheckFraud(orderId);
  const predict = usePredictFulfillment(orderId);
  const createNote = useCreateNote();

  const [note, setNote] = useState('');
  const [showStatus, setShowStatus] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [fraud, setFraud] = useState<FraudVerdict | null>(null);

  const order = detail.data;

  if (detail.isLoading || !order) {
    return (
      <Modal open onClose={onClose} title={orderNumber} size="lg">
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      </Modal>
    );
  }

  const canMutate = order.status !== 'CANCELLED' && order.status !== 'REFUNDED';

  function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    createNote.mutate(
      { id: orderId, input: { body: note.trim() } },
      {
        onSuccess: () => setNote(''),
      },
    );
  }

  return (
    <>
      <Modal open onClose={onClose} title={orderNumber} size="lg">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge label={order.status} />
                <span className="text-xs text-slate-500">{channelLabel(order.channel)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Placed {formatRelativeTime(order.createdAt)}
                {customerName || customerPhone ? ` · ${customerName || customerPhone}` : ''}
              </p>
            </div>
            {canMutate && (
              <div className="flex gap-2">
                <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => setShowStatus(true)}>
                  Update status
                </Button>
                {isOwnerAdmin && (
                  <>
                    <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => setShowRefund(true)}>
                      Refund
                    </Button>
                    <Button variant="danger" className="!px-3 !py-2 text-xs" onClick={() => setShowCancel(true)}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            )}
            {!isOwnerAdmin && canMutate && (
              <p className="text-xs text-slate-400">Refund &amp; cancel require owner/admin access.</p>
            )}
          </div>

          {/* Money summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Summary label="Subtotal" value={formatOrderMoney(toNumber(order.subtotal), order.currency)} />
            <Summary label="Discount" value={`−${formatOrderMoney(toNumber(order.discount), order.currency)}`} />
            <Summary label="Delivery" value={formatOrderMoney(toNumber(order.deliveryFee), order.currency)} />
            <Summary label="Total" value={formatOrderMoney(toNumber(order.total), order.currency)} accent />
          </div>

          {/* Logistics */}
          {(order.deliveryAddress || order.deliveryCity || order.paymentReference) && (
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              {order.paymentReference && (
                <p className="text-xs text-slate-500">Payment ref: {order.paymentReference}</p>
              )}
              {order.deliveryAddress && (
                <p className="mt-1 text-slate-700">📍 {order.deliveryAddress}{order.deliveryCity ? `, ${order.deliveryCity}` : ''}</p>
              )}
              {order.notes && <p className="mt-1 text-slate-600 italic">“{order.notes}”</p>}
            </div>
          )}

          {/* Items */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Items</h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {item.productName}
                      {item.variantName ? ` · ${item.variantName}` : ''}
                    </p>
                    {item.sku && <p className="text-xs text-slate-500">SKU {item.sku}</p>}
                    {item.note && <p className="text-xs text-slate-500 italic">{item.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {formatOrderMoney(toNumber(item.unitPrice), order.currency)} × {item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* AI insights */}
          <section className="rounded-lg border border-slate-200 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">AI insights</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                className="!px-3 !py-2 text-xs"
                loading={predict.isPending}
                onClick={() => predict.mutate()}
              >
                Estimate fulfillment
              </Button>
              <Button
                variant="secondary"
                className="!px-3 !py-2 text-xs"
                loading={checkFraud.isPending}
                onClick={() => checkFraud.mutate(undefined, { onSuccess: (v) => setFraud(v) })}
              >
                Run fraud check
              </Button>
            </div>
            {predict.data && (
              <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">
                  ~{formatDuration(predict.data.predictedMinutes)} · {Math.round(predict.data.confidence * 100)}% confidence
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                  {predict.data.basis.map((b) => (
                    <li key={b.label}>
                      {b.label} ({formatDuration(b.minutes)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {fraud && (
              <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${FRAUD_LEVEL_TONE[fraud.level]}`}>
                  {fraudLevelLabel(fraud.level)} ({fraud.riskScore}/100)
                </span>
                {fraud.signals.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                    {fraud.signals.map((s) => (
                      <li key={s.code}>
                        {s.detail} (+{s.weight})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {order.fraudScore !== null && !fraud && (
              <p className="mt-2 text-xs text-slate-500">Last scored: {order.fraudScore}/100 risk.</p>
            )}
          </section>

          {/* Notes */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Notes</h3>
            <form onSubmit={handleNoteSubmit} className="mb-2 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Add a note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Add a note"
              />
              <Button type="submit" className="!px-3 !py-2 text-xs" loading={createNote.isPending} disabled={!note.trim()}>
                Add
              </Button>
            </form>
            {notesQ.data && notesQ.data.length > 0 && (
              <ul className="space-y-1.5">
                {notesQ.data.map((n) => (
                  <li key={n.id} className="rounded-md bg-slate-50 p-2 text-sm">
                    <p className="text-slate-700">{n.body}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatRelativeTime(n.createdAt)}{n.pinned ? ' · pinned' : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Timeline */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Timeline</h3>
            {timelineQ.isLoading ? (
              <div className="flex h-16 items-center justify-center"><Spinner className="h-4 w-4" /></div>
            ) : (
              <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                {(timelineQ.data?.events ?? []).map((event, i) => (
                  <TimelineRow key={`${event.type}-${i}`} event={event} orderCurrency={order.currency} />
                ))}
              </ol>
            )}
          </section>
        </div>
      </Modal>

      {showStatus && <OrderStatusModal orderId={order.id} orderNumber={order.orderNumber} currentStatus={order.status} onClose={() => setShowStatus(false)} onDone={onChanged} />}
      {showRefund && <RefundModal orderId={order.id} orderNumber={order.orderNumber} total={order.total} currency={order.currency} onClose={() => setShowRefund(false)} onDone={onChanged} />}
      {showCancel && <CancelDialog orderId={order.id} orderNumber={order.orderNumber} onClose={() => setShowCancel(false)} onDone={onChanged} />}
    </>
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function TimelineRow({ event, orderCurrency }: { event: TimelineEvent; orderCurrency: string }) {
  switch (event.type) {
    case 'status': {
      const toLabel = (event.toStatus ?? event.fromStatus ?? '').replaceAll('_', ' ');
      const fromLabel = event.fromStatus?.replaceAll('_', ' ');
      return (
        <li className="text-sm">
          <p className="font-medium text-slate-900">
            {fromLabel && fromLabel !== toLabel ? `${fromLabel} → ${toLabel}` : toLabel}
          </p>
          {event.reason && <p className="text-xs text-slate-500">{event.reason}</p>}
          <p className="text-xs text-slate-400">{formatRelativeTime(event.at as string)}</p>
        </li>
      );
    }
    case 'note':
      return (
        <li className="text-sm">
          <p className="text-slate-700">📝 {event.body}</p>
          <p className="text-xs text-slate-400">{formatRelativeTime(event.at as string)}</p>
        </li>
      );
    case 'refund':
      return (
        <li className="text-sm">
          <p className="font-medium text-slate-900">
            💸 Refund {formatOrderMoney(event.amount ?? 0, orderCurrency)} ({event.refundStatus})
          </p>
          <p className="text-xs text-slate-400">{formatRelativeTime(event.at as string)}</p>
        </li>
      );
    case 'cancellation':
      return (
        <li className="text-sm">
          <p className="font-medium text-slate-900">✖️ Order cancelled{event.reason ? ` — ${event.reason}` : ''}</p>
          <p className="text-xs text-slate-400">{formatRelativeTime(event.at as string)}</p>
        </li>
      );
    default:
      return null;
  }
}
