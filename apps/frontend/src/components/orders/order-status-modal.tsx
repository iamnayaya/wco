'use client';

import { useState } from 'react';
import { Button, Field, Input, Badge } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import { useTransitionOrder } from './hooks';
import { nextTransitions, statusLabel } from './helpers';
import type { OrderStatus } from './types';

interface OrderStatusModalProps {
  orderId: string;
  orderNumber: string;
  currentStatus: OrderStatus;
  onClose: () => void;
  onDone: () => void;
}

export function OrderStatusModal({ orderId, orderNumber, currentStatus, onClose, onDone }: OrderStatusModalProps) {
  const [target, setTarget] = useState<OrderStatus | undefined>(undefined);
  const [reason, setReason] = useState('');
  const transition = useTransitionOrder();
  const options = nextTransitions(currentStatus);

  function submit() {
    if (!target || transition.isPending) return;
    transition.mutate(
      { id: orderId, status: target, reason: reason.trim() || undefined },
      { onSuccess: () => onDone() },
    );
  }

  return (
    <Modal open onClose={onClose} title={`Update status · ${orderNumber}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Current: <Badge label={currentStatus} />
        </p>

        {options.length === 0 ? (
          <p className="text-sm text-slate-500">{currentStatus === 'DELIVERED' ? 'This order is delivered.' : 'This order has no further transitions.'}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Move to</p>
            <div className="grid grid-cols-2 gap-2">
              {options.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTarget(s)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    target === s
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>
        )}

        {target === 'CANCELLED' && (
          <Field label="Reason (required for cancellation)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. buyer changed mind" />
          </Field>
        )}

        {transition.error && (
          <p className="text-sm text-red-600">{transition.error instanceof Error ? transition.error.message : 'Something went wrong'}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            disabled={!target}
            loading={transition.isPending}
            onClick={submit}
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}
