'use client';

import { Button, EmptyState, Input, Spinner } from '../../components/ui';
import { formatRelativeTime } from '../../lib/utils/format';
import { displayName, statusLabel } from './helpers';
import type { Thread, ThreadStatusFilter } from './types';

interface ThreadsListProps {
  threads: Thread[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  filter: ThreadStatusFilter;
  q: string;
  assignedToMe: boolean;
  selectedId: string | null;
  onFilterChange: (filter: ThreadStatusFilter) => void;
  onSearch: (q: string) => void;
  onToggleAssigned: () => void;
  onSelect: (thread: Thread) => void;
  onPageChange: (page: number) => void;
}

const FILTERS: ThreadStatusFilter[] = ['ALL', 'BOT', 'HANDLED', 'CLOSED'];

export function ThreadsList({
  threads,
  loading,
  total,
  page,
  totalPages,
  filter,
  q,
  assignedToMe,
  selectedId,
  onFilterChange,
  onSearch,
  onToggleAssigned,
  onSelect,
  onPageChange,
}: ThreadsListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Inbox</p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{total} chats</span>
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-emerald-600"
                checked={assignedToMe}
                onChange={onToggleAssigned}
              />
              Mine
            </label>
          </div>
        </div>
        <Input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name or phone…"
          aria-label="Search conversations"
          className="!py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-1 border-b border-slate-200 px-3 py-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilterChange(f)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'BOT' ? 'AI' : f === 'HANDLED' ? 'You' : 'Closed'}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && threads.length === 0 ? (
          <div className="flex h-full items-center justify-center py-16">
            <Spinner />
          </div>
        ) : threads.length === 0 ? (
          <EmptyState
            title="No conversations"
            description="When customers message your number, chats appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {threads.map((t) => {
              const active = t.id === selectedId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 ${
                      active ? 'bg-emerald-50/60' : ''
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {(displayName(t.waPhone, t.customer?.name ?? null).charAt(0) || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {displayName(t.waPhone, t.customer?.name ?? null)}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatRelativeTime(t.lastMessageAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {t.lastMessagePreview ?? ''}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-emerald-600">
                          {t.botEnabled ? 'AI on' : 'You on'}
                        </span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className={`text-[10px] font-medium ${t.status === 'BOT' ? 'text-slate-400' : t.status === 'HANDLED' ? 'text-sky-600' : 'text-slate-400'}`}>
                          {statusLabel(t.status)}
                        </span>
                      </div>
                    </div>
                    {t.unreadCount > 0 && (
                      <span className="mt-1 shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                        {t.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-3">
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </Button>
          <p className="text-xs text-slate-500">Page {page} / {totalPages}</p>
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
