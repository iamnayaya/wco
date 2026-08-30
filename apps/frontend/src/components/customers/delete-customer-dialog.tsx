'use client';

import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui';
import { useDeleteCustomer } from './hooks';

interface DeleteCustomerDialogProps {
  customerId: string;
  customerName: string | null;
  onClose: () => void;
  onDone: () => void;
}

export function DeleteCustomerDialog({ customerId, customerName, onClose, onDone }: DeleteCustomerDialogProps) {
  const deleteCustomer = useDeleteCustomer();

  function confirm() {
    if (deleteCustomer.isPending) return;
    deleteCustomer.mutate(customerId, { onSuccess: () => onDone() });
  }

  return (
    <Modal open onClose={onClose} title="Delete customer" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>{customerName || 'this customer'}</strong>?
        </p>
        <p className="text-sm text-slate-500">
          The customer record, its notes, tags and segment memberships will be permanently removed.
          Historical orders are kept for accounting integrity. This action cannot be undone.
        </p>
        {deleteCustomer.error && (
          <p className="text-sm text-red-600">
            {deleteCustomer.error instanceof Error ? deleteCustomer.error.message : 'Failed to delete customer'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteCustomer.isPending} onClick={confirm}>
            Delete customer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
