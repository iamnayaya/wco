'use client';

import { useState } from 'react';
import { Button, Field, Textarea } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import { useTransitionOrder } from './hooks';

interface CancelDialogProps {
  orderId: string;
  orderNumber: string;
  onClose: () => void;
  onDone: () => void;
}

export function CancelDialog({ orderId, orderNumber, onClose, onDone }: CancelDialogProps) {
  const [reason, setReason] = useState('');
  const transition = useTransitionOrder();

  function submit() {
    if (reason.trim().length < 3 || transition.isPending) return;
    transition.mutate({ id: orderId, status: 'CANCELLED', reason: reason.trim() }, { onSuccess: () => onDone() });
  }

  return (
    <Modal open onClose={onClose} title={`Cancel order · ${orderNumber}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          This will move the order to <strong>Cancelled</strong> and restore any reserved stock. This action cannot be undone.
        </p>

        <Field label="Reason (required)">
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this order being cancelled?"
          />
        </Field>
        {transition.error && (
          <p className="text-sm text-red-600">
            {transition.error instanceof Error ? transition.error.message : 'Failed to cancel order'}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="danger" loading={transition.isPending} disabled={reason.trim().length < 3} onClick={submit}>
            Cancel order
          </Button>
        </div>
      </div>
    </Modal>
  );
}
