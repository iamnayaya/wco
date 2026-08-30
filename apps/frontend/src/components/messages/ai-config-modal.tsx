'use client';

import { useState } from 'react';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import {
  useAiConfig,
  useAiIntents,
  useCreateIntent,
  useDeleteIntent,
  useUpdateAiConfig,
} from './hooks';
import { testAiConfig } from './api';
import type { AiTestResult, AiTone } from './types';

const TONES: AiTone[] = ['FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'CONCISE'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pcm', label: 'Pidgin' },
  { code: 'ha', label: 'Hausa' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'sw', label: 'Swahili' },
  { code: 'fr', label: 'French' },
];

interface AiConfigModalProps {
  onClose: () => void;
}

export function AiConfigModal({ onClose }: AiConfigModalProps) {
  const { data: config, isLoading } = useAiConfig();
  const { data: intents = [] } = useAiIntents();
  const update = useUpdateAiConfig();
  const createIntent = useCreateIntent();
  const deleteIntent = useDeleteIntent();

  const [testMsg, setTestMsg] = useState('');
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKeywords, setNewKeywords] = useState('');

  if (isLoading || !config) {
    return (
      <Modal open onClose={onClose} title="AI assistant">
        <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
      </Modal>
    );
  }

  const threshold = Number(config.confidenceThreshold ?? 0.6);

  async function runTest() {
    if (!testMsg.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testAiConfig(testMsg));
    } catch {
      setTestResult({ intent: 'ERROR', confidence: 0, entities: {}, language: '', withinSessionWindow: true, wouldEscalate: true, draftReply: 'Test failed — try again.' });
    } finally {
      setTesting(false);
    }
  }

  function addIntent() {
    const keywords = newKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (!newName.trim() || keywords.length === 0) return;
    createIntent.mutate(
      { name: newName.trim().toUpperCase().replaceAll(' ', '_'), keywords },
      { onSuccess: () => { setNewName(''); setNewKeywords(''); } },
    );
  }

  return (
    <Modal open onClose={onClose} title="AI assistant" size="lg">
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Auto-reply enabled</p>
            <p className="text-xs text-slate-500">
              {config.isEnabled
                ? 'New inbound messages get an AI reply first.'
                : 'AI is paused — messages go straight to you.'}
            </p>
          </div>
          <button
            type="button"
            data-on={config.isEnabled}
            onClick={() => update.mutate({ isEnabled: !config.isEnabled })}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-300 transition-colors data-[on=true]:bg-emerald-500"
            aria-pressed={config.isEnabled}
            aria-label="Toggle auto-reply"
          >
            <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition-transform data-[on=true]:translate-x-6" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tone">
            <select
              className="input w-full"
              value={config.tone}
              onChange={(e) => update.mutate({ tone: e.target.value as AiTone })}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Confidence threshold">
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={threshold}
              onChange={(e) => update.mutate({ confidenceThreshold: Number(e.target.value) })}
              className="w-full accent-emerald-600"
            />
            <p className="text-xs text-slate-500">{(threshold * 100).toFixed(0)}% — below this the bot hands off to a human</p>
          </Field>
        </div>

        <Field label="Languages">
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => {
              const active = config.languages.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? config.languages.filter((l) => l !== lang.code)
                      : [...config.languages, lang.code];
                    if (next.length > 0) update.mutate({ languages: next });
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Business context (policies, FAQ)">
          <Textarea
            rows={3}
            defaultValue={config.businessContext ?? ''}
            placeholder="What policies should the AI follow? E.g. delivery to Lekki, returns within 7 days…"
            onBlur={(e) => {
              const val = e.target.value.trim();
              update.mutate({ businessContext: val || null });
            }}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Playground — test the classifier</p>
          <div className="flex gap-2">
            <Input
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              placeholder="e.g. I want a refund for my order"
              onKeyDown={(e) => { if (e.key === 'Enter') void runTest(); }}
            />
            <Button variant="secondary" className="shrink-0" loading={testing} onClick={() => void runTest()}>
              Test
            </Button>
          </div>
          {testResult && (
            <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p>
                <span className="font-semibold">Intent:</span> {testResult.intent} ·{' '}
                <span className="font-semibold">Confidence:</span> {(testResult.confidence * 100).toFixed(1)}%
              </p>
              <p>
                <span className="font-semibold">Language:</span> {testResult.language} ·{' '}
                <span className="font-semibold">Would escalate:</span> {testResult.wouldEscalate ? 'yes' : 'no'}
              </p>
              <p className="text-slate-500">{testResult.draftReply}</p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Taught intents ({intents.length})</p>
          <div className="flex flex-wrap gap-2">
            {intents.map((intent) => (
              <span key={intent.id} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                {intent.name}
                <button
                  type="button"
                  onClick={() => deleteIntent.mutate(intent.id)}
                  className="text-violet-400 hover:text-red-600"
                  aria-label={`Delete ${intent.name}`}
                >
                  ×
                </button>
              </span>
            ))}
            {intents.length === 0 && <span className="text-xs text-slate-400">No custom intents yet.</span>}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Intent name (e.g. DELIVERY_LEKKI)"
              className="text-xs"
            />
            <Input
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              placeholder="Keywords, comma separated"
              className="text-xs"
            />
            <Button variant="secondary" className="!px-3 !py-2 text-xs" onClick={addIntent}>
              + Add
            </Button>
          </div>
          {createIntent.isError && <p className="mt-1 text-xs font-medium text-red-600">{createIntent.error.message}</p>}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
