'use client';

import { useState } from 'react';
import { Button, EmptyState } from '../../../components/ui';
import { useAuthStore } from '../../../store/slices/auth-slice';
import { ThreadsList } from '../../../components/messages/threads-list';
import { ConversationView } from '../../../components/messages/conversation-view';
import { AiConfigModal } from '../../../components/messages/ai-config-modal';
import { AiActivityPanel } from '../../../components/messages/ai-activity-panel';
import { useThreadsList, useThreadDetail } from '../../../components/messages/hooks';
import { exportMessagesCsv } from '../../../components/messages/api';
import type { Thread, ThreadStatusFilter } from '../../../components/messages/types';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Inbox — two-column WhatsApp conversations UI.
 * Polls the thread list + open conversation every 15s (the real-time layer
 * for this module is polling, matching the pre-existing inbox behavior).
 * Mutations (send, takeover, escalate, close) require conversation:handle,
 * i.e. OWNER/ADMIN.
 */
export default function ConversationsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'OWNER' || role === 'ADMIN';

  const [filter, setFilter] = useState<ThreadStatusFilter>('ALL');
  const [q, setQ] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const threads = useThreadsList({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    status: filter === 'ALL' ? undefined : filter,
    q: q || undefined,
    assignedToMe,
  });
  const selectedThread = useThreadDetail(selectedId);

  const items = threads.data?.items ?? [];
  const meta = threads.data?.meta;
  const activeThread: Thread | null = selectedThread.data ?? items.find((t) => t.id === selectedId) ?? null;

  function handleSearch(next: string) {
    setQ(next);
    setPage(1);
  }

  function handleFilter(next: ThreadStatusFilter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <h1 className="text-lg font-bold text-slate-900">Inbox</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => setShowActivity((v) => !v)}>
            {showActivity ? 'Hide AI activity' : 'AI activity'}
          </Button>
          <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => exportMessagesCsv()}>
            Export CSV
          </Button>
          <Button className="!px-3 !py-2 text-xs" onClick={() => setShowAiConfig(true)}>
            ✨ AI settings
          </Button>
        </div>
      </div>

      {showActivity && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
          <AiActivityPanel />
        </div>
      )}

      {/* Two-column layout */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.length === 0 && !threads.isLoading ? (
          <div className="flex h-full items-center justify-center p-10">
            <EmptyState
              title={q ? 'No matching chats' : 'No conversations yet'}
              description={q ? 'Try a different name or phone number.' : 'When customers message your WhatsApp number, chats appear here.'}
            />
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left: threads */}
            <div className="hidden w-80 shrink-0 border-r border-slate-200 sm:block">
              <ThreadsList
                threads={items}
                loading={threads.isLoading}
                total={meta?.totalItems ?? 0}
                page={page}
                totalPages={meta?.totalPages ?? 1}
                filter={filter}
                q={q}
                assignedToMe={assignedToMe}
                selectedId={selectedId}
                onFilterChange={handleFilter}
                onSearch={handleSearch}
                onToggleAssigned={() => {
                  setAssignedToMe((v) => !v);
                  setPage(1);
                }}
                onSelect={(t) => setSelectedId(t.id)}
                onPageChange={setPage}
              />
            </div>

            {/* Right: conversation or empty pick state */}
            <div className="min-h-0 flex-1">
              {activeThread ? (
                <ConversationView
                  thread={activeThread}
                  canWrite={canWrite}
                  escalated={escalating}
                  onEscalating={() => setEscalating(true)}
                  onCloseEscalate={() => setEscalating(false)}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-10">
                  <EmptyState title="Select a conversation" description="Pick a chat from the list to view and reply." />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showAiConfig && <AiConfigModal onClose={() => setShowAiConfig(false)} />}
    </div>
  );
}
