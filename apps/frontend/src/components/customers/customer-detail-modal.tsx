'use client';

import { useState } from 'react';
import { Badge, Button, Spinner } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import { formatMoney, formatRelativeTime } from '../../lib/utils/format';
import {
  useAddCustomerTags,
  useCustomerMessages,
  useCustomerNotes,
  useCustomerOrders,
  useCustomerStats,
  useCreateCustomerNote,
  useDeleteCustomerNote,
  useTags,
} from './hooks';
import { isBadgedSegment, segmentLabel, toNumber } from './helpers';

interface CustomerDetailModalProps {
  customerId: string;
  customerName: string | null;
  customerPhone: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onChanged: () => void;
}

export function CustomerDetailModal({
  customerId,
  customerName,
  customerPhone,
  onEdit,
  onDelete,
  onClose,
  onChanged,
}: CustomerDetailModalProps) {
  const stats = useCustomerStats(customerId);
  const orders = useCustomerOrders(customerId);
  const messages = useCustomerMessages(customerId);
  const notes = useCustomerNotes(customerId);
  const tagsQ = useTags();
  const addTags = useAddCustomerTags();
  const createNote = useCreateCustomerNote();
  const deleteNote = useDeleteCustomerNote();

  const [note, setNote] = useState('');
  const [pendingTag, setPendingTag] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);

  const loading = stats.isLoading;

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() || createNote.isPending) return;
    createNote.mutate(
      { id: customerId, input: { body: note.trim() } },
      { onSuccess: () => setNote('') },
    );
  }

  function assignTag() {
    const name = pendingTag.trim();
    if (!name) return;
    if ((stats.data?.tags ?? []).includes(name)) {
      setTagError('Customer already has this tag.');
      return;
    }
    setTagError(null);
    addTags.mutate(
      { id: customerId, tags: [name] },
      { onSuccess: () => setPendingTag('') },
    );
  }

  return (
    <Modal open onClose={onClose} title={customerName || customerPhone} size="lg">
      {loading || !stats.data ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">{customerPhone}</p>
                {stats.data.marketingOptIn && <Badge label="Opted in" tone="PAID" />}
              </div>
              {stats.data.segment && (
                <p className="mt-1 text-xs text-slate-500">
                  Segment:{' '}
                  <Badge
                    label={isBadgedSegment(stats.data.segment) ? stats.data.segment : segmentLabel(stats.data.segment)}
                    tone={stats.data.segment as never}
                  />
                </p>
              )}
              {stats.data.lastSeenAt && (
                <p className="mt-1 text-xs text-slate-400">Last seen {formatRelativeTime(stats.data.lastSeenAt)}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={onEdit}>
                Edit
              </Button>
              <Button variant="danger" className="!px-3 !py-2 text-xs" onClick={onDelete}>
                Delete
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Summary label="Total spent" value={formatMoney(stats.data.totalSpent)} accent />
            <Summary label="Orders" value={String(stats.data.ordersCount)} />
            <Summary label="Avg order" value={formatMoney(stats.data.avgOrderValue)} />
            <Summary label="First order" value={stats.data.firstOrderAt ? formatRelativeTime(stats.data.firstOrderAt) : '—'} />
          </div>

          {/* Tags */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Tags</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {stats.data.tags.length === 0 ? (
                  <span className="text-xs text-slate-400">No tags yet</span>
                ) : (
                  stats.data.tags.map((tag) => <Badge key={tag} label={tag} />)
                )}
              </div>
              <div className="flex flex-1 gap-2 sm:max-w-sm">
                <select
                  className="input flex-1"
                  value={pendingTag}
                  onChange={(e) => setPendingTag(e.target.value)}
                  aria-label="Choose a tag"
                >
                  <option value="">Choose a tag…</option>
                  {(tagsQ.data ?? [])
                    .filter((t) => !stats.data.tags.includes(t.name))
                    .map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <Button variant="secondary" className="!px-3 !py-2 text-xs" disabled={!pendingTag} loading={addTags.isPending} onClick={assignTag}>
                  Add
                </Button>
              </div>
            </div>
            {tagError && <p className="mt-1 text-xs text-red-600">{tagError}</p>}
          </section>

          {/* Order history */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Order history</h3>
            {orders.isLoading ? (
              <div className="flex h-12 items-center justify-center"><Spinner className="h-4 w-4" /></div>
            ) : (orders.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No orders yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {(orders.data ?? []).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{order.orderNumber}</p>
                      <p className="text-xs text-slate-500">{formatRelativeTime(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge label={order.status} tone={order.status as never} />
                      <span className="font-semibold tabular-nums">{formatMoney(toNumber(order.total), order.currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Message history */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Message history</h3>
            {messages.isLoading ? (
              <div className="flex h-12 items-center justify-center"><Spinner className="h-4 w-4" /></div>
            ) : (messages.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet.</p>
            ) : (
              <div className="space-y-1.5">
                {(messages.data ?? []).slice(0, 10).map((m) => (
                  <div key={m.id} className="rounded-md bg-slate-50 p-2 text-sm">
                    <p className="text-slate-700">{m.body}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {m.direction === 'INBOUND' ? 'Customer → You' : 'You → Customer'} · {formatRelativeTime(m.createdAt)}
                    </p>
                  </div>
                ))}
                {(messages.data ?? []).length > 10 && (
                  <p className="text-xs text-slate-400">Showing 10 of {(messages.data ?? []).length} messages.</p>
                )}
              </div>
            )}
          </section>

          {/* Notes */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Notes</h3>
            <form onSubmit={submitNote} className="mb-2 flex gap-2">
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
            {notes.data && notes.data.length > 0 ? (
              <ul className="space-y-1.5">
                {notes.data.map((n) => (
                  <li key={n.id} className="rounded-md bg-slate-50 p-2 text-sm">
                    <p className="text-slate-700">{n.body}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                      <span>{formatRelativeTime(n.createdAt)}</span>
                      {n.pinned && <span>· pinned</span>}
                      <button
                        type="button"
                        className="font-semibold text-slate-500 hover:text-red-600"
                        disabled={deleteNote.isPending}
                        onClick={() => deleteNote.mutate({ id: customerId, noteId: n.id })}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No notes yet.</p>
            )}
          </section>
        </div>
      )}
    </Modal>
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
