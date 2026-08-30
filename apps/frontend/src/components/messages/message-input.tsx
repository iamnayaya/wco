'use client';

import { useState } from 'react';
import { Button, Textarea } from '../../components/ui';
import { useGenerateAiDraft, useSendAsBot, useSendThreadMessage } from './hooks';

interface MessageInputProps {
  threadId: string;
  disabled: boolean;
}

export function MessageInput({ threadId, disabled }: MessageInputProps) {
  const [draft, setDraft] = useState('');
  const [aiDraft, setAiDraft] = useState('');
  const [aiMode, setAiMode] = useState(false);

  const send = useSendThreadMessage();
  const sendBot = useSendAsBot();
  const generate = useGenerateAiDraft();

  function submitAsHuman() {
    const body = (aiMode ? aiDraft : draft).trim();
    if (!body) return;
    if (aiMode) {
      sendBot.mutate({ threadId, body }, { onSettled: () => setAiDraft('') });
    } else {
      send.mutate(
        { threadId, input: { type: 'TEXT', body } },
        { onSettled: () => setDraft('') },
      );
    }
  }

  function handleGenerate() {
    if (aiMode && aiDraft) {
      generate.mutate({ text: aiDraft });
      return;
    }
    if (draft.trim()) {
      generate.mutate({ text: draft }, {
        onSuccess: (res) => {
          setAiDraft(res.draft);
          setAiMode(true);
        },
      });
    } else {
      generate.mutate({ threadId }, {
        onSuccess: (res) => {
          setAiDraft(res.draft);
          setAiMode(true);
        },
      });
    }
  }

  return (
    <div className="border-t border-slate-200 p-3">
      {aiDraft && (
        <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">AI draft</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-[10px] font-medium text-slate-500 hover:text-slate-700"
                onClick={() => setAiDraft('')}
              >
                Discard
              </button>
              <button
                type="button"
                className="text-[10px] font-medium text-emerald-600 hover:text-emerald-800"
                onClick={() => {
                  setAiDraft('');
                  setAiMode(false);
                }}
              >
                Edit as human
              </button>
            </div>
          </div>
          <Textarea
            value={aiDraft}
            onChange={(e) => setAiDraft(e.target.value)}
            rows={3}
            className="text-sm"
            aria-label="AI draft"
          />
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={aiMode ? 'Start a new human message…' : 'Type a message…'}
          rows={2}
          className="min-h-0 flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitAsHuman();
            }
          }}
          aria-label="Message"
        />
        <Button
          variant="secondary"
          className="!px-3 !py-2 text-xs"
          loading={generate.isPending}
          onClick={handleGenerate}
          title="Draft reply with AI"
        >
          ✨ AI
        </Button>
        <Button
          className="!px-4 !py-2 text-sm"
          loading={send.isPending || sendBot.isPending}
          disabled={disabled || (!draft.trim() && !aiDraft.trim())}
          onClick={submitAsHuman}
        >
          Send
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        Enter to send · Shift+Enter for a new line · AI replies are sent as the bot.
      </p>
    </div>
  );
}
