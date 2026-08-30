'use client';

import { useState } from 'react';
import { Button, Field, Textarea } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import { escalationReasonLabel } from './helpers';
import { useCreateEscalation } from './hooks';
import type { EscalationReason } from './types';

const REASONS: EscalationReason[] = [
  'COMPLAINT',
  'REFUND_REQUEST',
  'PAYMENT_ISSUE',
  'CUSTOM_QUOTE',
  'HUMAN_REQUESTED',
  'NEGATIVE_SENTIMENT',
  'LOW_CONFIDENCE',
];

interface EscalationDialogProps {
  threadId: string;
  messageId?: string;
  onClose: () => void;
  onDone: () => void;
}

export function EscalationDialog({ threadId, messageId, onClose, onDone }: EscalationDialogProps) {
  const create = useCreateEscalation();
  const [reason, setReason] = useState<EscalationReason>('COMPLAINT');
  const [notes, setNotes] = useState('');

  function submit() {
    create.mutate(
      { threadId, messageId, reason, notes: notes.trim() || undefined },
      { onSuccess: () => onDone() },
    );
  }

  return (
    <Modal open onClose={onClose} title="Escalate to a human">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          This pauses the AI for this chat and flags it for a human agent to take over.
        </p>
        <Field label="Reason">
          <select
            className="input w-full"
            value={reason}
            onChange={(e) => setReason(e.target.value as EscalationReason)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {escalationReasonLabel(r)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes (optional)">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What should the human agent know?"
          />
        </Field>
        {create.isError && (
          <p className="text-sm font-medium text-red-600">{create.error.message}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Escalate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
