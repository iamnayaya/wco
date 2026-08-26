'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { Badge, EmptyState, Spinner } from '../../../components/ui';
import { formatMoney, formatRelativeTime } from '../../../lib/utils/format';

interface ConversationSummary {
  id: string;
  customerName: string;
  customerPhone: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  status: string;
  unreadCount: number;
  botEnabled: boolean;
}

/**
 * Inbox — the merchant's WhatsApp conversations.
 * Polls every 15s; optimistic takeover via PATCH /conversations/:id/bot.
 */
export default function InboxPage() {
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<{ items: ConversationSummary[]; nextCursor: string | null }>('/conversations'),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Inbox</h1>
        <span className="text-xs text-slate-500">
          {conversations.data?.items.filter((c) => c.unreadCount > 0).length ?? 0} unread
        </span>
      </div>

      {conversations.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (conversations.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="When customers message your WhatsApp number, chats appear here — AI replies first, you take over anytime."
        />
      ) : (
        <ul className="space-y-2">
          {conversations.data?.items.map((c) => (
            <li key={c.id} className={`card p-4 ${c.unreadCount > 0 ? 'border-l-4 border-l-emerald-500' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {c.customerName || c.customerPhone}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-600">{c.lastMessagePreview}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(c.lastMessageAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {c.unreadCount > 0 && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                  <Badge
                    label={c.status}
                    tone={c.status === 'ESCALATED' ? 'CHURN_RISK' : c.status === 'HANDLED' ? 'PAID' : 'PENDING_PAYMENT'}
                  />
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    {c.botEnabled ? '🤖 AI on' : '👤 You'}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
