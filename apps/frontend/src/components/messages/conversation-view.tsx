'use client';

import { useEffect, useRef } from 'react';
import { Button, EmptyState, Spinner } from '../../components/ui';
import { formatRelativeTime } from '../../lib/utils/format';
import { displayName } from './helpers';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { EscalationDialog } from './escalation-dialog';
import { useThreadMessages, useUpdateThread } from './hooks';
import type { Thread } from './types';

interface ConversationViewProps {
  thread: Thread;
  canWrite: boolean;
  onEscalating: () => void;
  escalated: boolean;
  onCloseEscalate: () => void;
}

export function ConversationView({ thread, canWrite, onEscalating, escalated, onCloseEscalate }: ConversationViewProps) {
  const { data, isLoading } = useThreadMessages(thread.id);
  const update = useUpdateThread();
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = data?.items ?? [];
  const closed = thread.status === 'CLOSED';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, thread.id]);

  function toggleBot() {
    update.mutate({ id: thread.id, input: { botEnabled: !thread.botEnabled } });
  }

  function closeThread() {
    update.mutate({ id: thread.id, input: { status: 'CLOSED', botEnabled: false } });
  }

  function openThread() {
    update.mutate({ id: thread.id, input: { status: 'BOT', botEnabled: true } });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {displayName(thread.waPhone, thread.customer?.name ?? null)}
          </p>
          <p className="truncate text-xs text-slate-500">{thread.waPhone}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!closed && canWrite && (
            <>
              <Button
                variant="secondary"
                className="!px-3 !py-1.5 text-xs"
                loading={update.isPending}
                onClick={toggleBot}
              >
                {thread.botEnabled ? 'Take over (AI off)' : 'AI on'}
              </Button>
              <Button
                variant="danger"
                className="!px-3 !py-1.5 text-xs"
                onClick={onEscalating}
              >
                Escalate
              </Button>
            </>
          )}
          {canWrite && (
            <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={closed ? openThread : closeThread}>
              {closed ? 'Reopen' : 'Close'}
            </Button>
          )}
        </div>
      </div>

      {/* Thread meta strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-slate-100 px-4 py-2 text-[10px] text-slate-400">
        <span className={thread.botEnabled ? 'font-semibold text-violet-600' : 'font-semibold text-sky-600'}>
          {thread.botEnabled ? '🤖 AI handling replies' : '👤 Human handling replies'}
        </span>
        <span>·</span>
        <span>Last activity {formatRelativeTime(thread.lastMessageAt)}</span>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4" ref={scrollRef}>
        {isLoading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center"><Spinner /></div>
        ) : messages.length === 0 ? (
          <EmptyState title="No messages yet" description="Replies you send appear here." />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
        {closed && (
          <p className="mt-3 text-center text-xs font-medium text-slate-400">
            Thread closed — no more messages can be sent here.
          </p>
        )}
      </div>

      {!closed && (
        <MessageInput threadId={thread.id} disabled={!canWrite} />
      )}

      {escalated && (
        <EscalationDialog threadId={thread.id} onClose={onCloseEscalate} onDone={onCloseEscalate} />
      )}
    </div>
  );
}
