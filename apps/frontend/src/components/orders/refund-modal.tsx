'use client';

import { useState } from 'react';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import { useCreateRefund } from './hooks';
import { formatOrderMoney } from './helpers';
import { toNumber } from './types';

interface RefundModalProps {
  orderId: string;
  orderNumber: string;
  total: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}

export function RefundModal({ orderId, orderNumber, total, currency, onClose, onDone }: RefundModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const createRefund = useCreateRefund();
  const max = toNumber(total);
  const parsed = toNumber(amount);

  const validationError =
    amount && (parsed <= 0 ? 'Amount must be greater than 0' : parsed > max ? `Cannot exceed ${formatOrderMoney(max, currency)}` : '');

  function submit() {
    if (!amount || validationError || createRefund.isPending) return;
    createRefund.mutate(
      { id: orderId, input: { amount: parsed, reason: reason.trim() || undefined } },
      { onSuccess: () => onDone() },
    );
  }

  return (
    <Modal open onClose={onClose} title={`Issue refund · ${orderNumber}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Refundable total: <span className="font-semibold text-slate-900">{formatOrderMoney(max, currency)}</span>
        </p>

        <Field label="Amount">
          <Input
            required
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder={String(max)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field label="Reason (optional)">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged item" />
        </Field>

        {validationError && <p className="text-sm text-red-600">{validationError}</p>}
        {createRefund.error && (
          <p className="text-sm text-red-600">
            {createRefund.error instanceof Error ? createRefund.error.message : 'Failed to create refund'}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button loading={createRefund.isPending} disabled={!amount || Boolean(validationError)} onClick={submit}>
            Create refund
          </Button>
        </div>
      </div>
    </Modal>
  );
}
