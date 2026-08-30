'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui';
import { useAuthStore } from '../../../store/slices/auth-slice';
import { formatMoney } from '../../../lib/utils/format';
import { useCustomersList, useDeleteCustomer, useRunAutoSegment } from '../../../components/customers/hooks';
import { CustomersFilter } from '../../../components/customers/customers-filter';
import { CustomersTable } from '../../../components/customers/customers-table';
import { CustomerFormModal } from '../../../components/customers/customer-form-modal';
import { CustomerDetailModal } from '../../../components/customers/customer-detail-modal';
import { DeleteCustomerDialog } from '../../../components/customers/delete-customer-dialog';
import { exportCustomersCsv, importCustomersCsv } from '../../../components/customers/api';
import { importSummary } from '../../../components/customers/helpers';
import type { Customer, ListCustomersParams } from '../../../components/customers/types';

const DEFAULT_PAGE_SIZE = 20;

export default function CustomersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'OWNER' || role === 'ADMIN';

  const [params, setParams] = useState<ListCustomersParams>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string | null } | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customers = useCustomersList(params);
  const deleteCustomer = useDeleteCustomer();
  const autoSegment = useRunAutoSegment();

  const items = customers.data?.items ?? [];

  function patchParams(patch: Partial<ListCustomersParams>) {
    setParams((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  function clearFilters() {
    setParams((prev) => ({
      page: 1,
      pageSize: prev.pageSize,
      sortBy: prev.sortBy,
      sortOrder: prev.sortOrder,
    }));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function handleExport() {
    exportCustomersCsv(params);
  }

  async function handleImportFile(file: File) {
    try {
      const report = await importCustomersCsv(file);
      setImportMsg(importSummary(report));
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Import failed');
    }
    window.setTimeout(() => setImportMsg(null), 7000);
  }

  function deleteSelected() {
    const targets = Array.from(selected);
    for (const id of targets) {
      deleteCustomer.mutate(id);
    }
    setSelected(new Set());
  }

  const stats = useMemo(() => {
    if (!customers.data) return null;
    const totalSpent = items.reduce((sum, c) => sum + Number(c.totalSpent || 0), 0);
    return { total: customers.data.meta.totalItems, totalSpent };
  }, [customers.data, items]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">Customers</h1>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={handleExport}>
              Export CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="Import customers CSV"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => fileInputRef.current?.click()}>
              Import CSV
            </Button>
            <Button
              variant="secondary"
              className="!px-3 !py-2 text-xs"
              loading={autoSegment.isPending}
              onClick={() => autoSegment.mutate()}
            >
              {autoSegment.isPending ? 'Segmenting…' : '✨ AI segment'}
            </Button>
            <Button className="!px-3 !py-2 text-xs" onClick={() => setShowCreate(true)}>
              + New customer
            </Button>
          </div>
        )}
      </div>

      {/* Import result notification */}
      {importMsg && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {importMsg}
        </div>
      )}

      {/* Auto-segment result */}
      {autoSegment.data && (
        <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <p className="font-medium">AI segmentation complete</p>
          {autoSegment.data.perSegment.map((s) => (
            <p key={s.segmentId} className="mt-0.5 text-xs">
              {s.name.replaceAll('_', ' ')}: {s.members} members ({s.added} added, {s.removed} removed)
            </p>
          ))}
        </div>
      )}

      {/* Summary */}
      {stats && (
        <div className="flex flex-wrap gap-4 text-sm">
          <p className="text-slate-600">
            <span className="font-bold text-slate-900">{stats.total}</span> customers
          </p>
          <p className="text-slate-600">
            Lifetime revenue <span className="font-bold text-slate-900">{formatMoney(stats.totalSpent)}</span>
          </p>
        </div>
      )}

      {/* Filters */}
      <CustomersFilter params={params} onParamsChange={patchParams} onClear={clearFilters} />

      {/* Bulk actions */}
      {selected.size > 0 && canWrite && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
          <p className="text-sm font-medium text-slate-700">{selected.size} selected</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              variant="danger"
              className="!px-3 !py-1.5 text-xs"
              loading={deleteCustomer.isPending}
              onClick={deleteSelected}
            >
              Delete selected
            </Button>
          </div>
        </div>
      )}

      <CustomersTable
        customers={items}
        meta={customers.data?.meta}
        loading={customers.isLoading}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        sortBy={params.sortBy ?? 'createdAt'}
        sortOrder={params.sortOrder ?? 'desc'}
        onSort={(field) => {
          const nextOrder =
            params.sortBy === field && params.sortOrder === 'asc' ? 'desc' : 'asc';
          setParams((prev) => ({ ...prev, page: 1, sortBy: field, sortOrder: nextOrder }));
        }}
        onView={(c) => setViewCustomer(c)}
        onPageChange={(page) => setParams((prev) => ({ ...prev, page }))}
        onPageSizeChange={(size) => setParams((prev) => ({ ...prev, pageSize: size, page: 1 }))}
      />

      {/* Modals */}
      {viewCustomer && (
        <CustomerDetailModal
          customerId={viewCustomer.id}
          customerName={viewCustomer.name}
          customerPhone={viewCustomer.waPhone}
          onEdit={() => {
            setEditTarget(viewCustomer);
            setViewCustomer(null);
          }}
          onDelete={() => {
            setDeleteTarget({ id: viewCustomer.id, name: viewCustomer.name });
            setViewCustomer(null);
          }}
          onClose={() => setViewCustomer(null)}
          onChanged={() => setViewCustomer(null)}
        />
      )}
      {editTarget && (
        <CustomerFormModal
          customerId={editTarget.id}
          onClose={() => setEditTarget(null)}
          onDone={() => setEditTarget(null)}
        />
      )}
      {showCreate && (
        <CustomerFormModal
          onClose={() => setShowCreate(false)}
          onDone={() => {
            setShowCreate(false);
            setParams((prev) => ({ ...prev, page: 1 }));
          }}
        />
      )}
      {deleteTarget && (
        <DeleteCustomerDialog
          customerId={deleteTarget.id}
          customerName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onDone={() => {
            setDeleteTarget(null);
            setViewCustomer(null);
          }}
        />
      )}
    </div>
  );
}
