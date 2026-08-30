'use client';

import { cn } from '../../lib/utils/format';
import { formatRelativeTime } from '../../lib/utils/format';
import { messageStatusLabel } from './helpers';
import type { Message } from './types';

interface MessageBubbleProps {
  message: Message;
}

function isMedia(m: Message): boolean {
  return ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'].includes(m.type) && Boolean(m.mediaUrl);
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const outbound = message.direction === 'OUTBOUND';
  const media = isMedia(message);

  return (
    <div className={cn('flex w-full', outbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          outbound
            ? 'rounded-br-sm bg-emerald-600 text-white'
            : message.sentByBot
              ? 'rounded-bl-sm border border-violet-200 bg-violet-50 text-slate-800'
              : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800',
        )}
      >
        {message.sentByBot && !outbound && (
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-500">AI</p>
        )}
        {media && message.mediaUrl && (
          <div className="mb-1.5">
            {message.type === 'IMAGE' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.mediaUrl} alt={message.body ?? 'image'} className="max-h-56 rounded-lg object-cover" />
            ) : (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium underline',
                  outbound ? 'text-white' : 'text-emerald-700',
                )}
              >
                {message.type.toLowerCase()} attachment
              </a>
            )}
          </div>
        )}
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        {!message.body && !media && <p className="italic opacity-70">[{message.type.toLowerCase()}]</p>}
        <p
          className={cn(
            'mt-1 text-right text-[10px]',
            outbound ? 'text-emerald-100' : 'text-slate-400',
          )}
        >
          {formatRelativeTime(message.createdAt)}
          {outbound && message.status !== 'QUEUED' && ` · ${messageStatusLabel(message.status)}`}
          {message.status === 'FAILED' && ' · failed'}
        </p>
      </div>
    </div>
  );
}
