'use client';

import Link from 'next/link';
import { Card, Spinner, EmptyState } from '../../components/ui';
import { cn } from '../../lib/utils/format';
import type { RecentMessage } from '../../hooks/use-dashboard';

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface RecentMessagesProps {
  messages?: RecentMessage[];
  isLoading: boolean;
}

export function RecentMessages({ messages, isLoading }: RecentMessagesProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Messages</h3>
        <Link
          href="/conversations"
          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : !messages?.length ? (
        <div className="py-6">
          <EmptyState
            title="No messages yet"
            description="Customer messages will appear here."
          />
        </div>
      ) : (
        <div className="mt-3 divide-y divide-slate-50 dark:divide-slate-800">
          {messages.map((msg) => (
            <Link
              key={msg.id}
              href="/conversations"
              className="flex items-start gap-3 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 rounded-lg"
            >
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  {msg.customerName?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                {msg.unread && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-800" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      'truncate text-sm',
                      msg.unread
                        ? 'font-semibold text-slate-900 dark:text-white'
                        : 'font-medium text-slate-700 dark:text-slate-300',
                    )}
                  >
                    {msg.customerName}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {timeAgo(msg.time)}
                  </span>
                </div>
                <p
                  className={cn(
                    'mt-0.5 truncate text-xs',
                    msg.unread
                      ? 'font-medium text-slate-700 dark:text-slate-300'
                      : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  {msg.preview}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
