'use client';

import { useState } from 'react';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Textarea, Spinner } from '../../../components/ui';
import { Section, Toggle, SegmentGroup, RangeSlider } from '../primitives';
import { AI_LANGUAGES, TONES } from '../helpers';
import { useAiConfig, useTestAi, useUpdateAiConfig } from '../hooks';

export function AiTab() {
  return (
    <div className="space-y-6">
      <AutoResponderSection />
      <PricingOptimizerSection />
      <InsightsSection />
      <DescriptionSection />
      <SegmentationSection />
      <TestSection />
    </div>
  );
}

function AutoResponderSection() {
  const { data, isLoading } = useAiConfig();
  const update = useUpdateAiConfig();
  const cfg = data ?? {};
  function set<K extends keyof typeof cfg>(k: K, v: typeof cfg[K]) {
    update.mutate({ [k]: v }, { onSuccess: () => toast.success('AI auto-responder saved') });
  }
  if (isLoading) return <Section title="AI auto-responder"><div className="flex justify-center py-6"><Spinner /></div></Section>;
  return (
    <Section title="AI auto-responder" description="Core AI reply behaviour for your store.">
      <div className="space-y-5">
        <Toggle label="Enable AI responses" checked={Boolean(cfg.isEnabled)} onChange={(v) => set('isEnabled', v)} />
        <SegmentGroup label="Response tone" value={cfg.tone ?? 'FRIENDLY'} onChange={(v) => set('tone', v)} options={TONES} />
        <LanguagesSelect label="Response languages" value={cfg.languages ?? ['en']} onChange={(v) => set('languages', v)} />
        <RangeSlider label="Confidence threshold" value={cfg.confidenceThreshold ?? 0.7} min={0.1} max={1} suffix="%" onChange={(v) => set('confidenceThreshold', Number(v.toFixed(2)))} />
      </div>
    </Section>
  );
}

function LanguagesSelect({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(v: string) {
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(next.length ? next : ['en']);
  }
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {AI_LANGUAGES.map((o) => (
          <button key={o.value} type="button" aria-pressed={value.includes(o.value)} onClick={() => toggle(o.value)}
            className={value.includes(o.value) ? 'rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white' : 'rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600'}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function PricingOptimizerSection() {
  const [enabled, setEnabled] = useState(false);
  const [strategy, setStrategy] = useState<'competitive' | 'value' | 'cost-plus'>('competitive');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
  return (
    <Section title="AI pricing optimizer" description="Let AI suggest optimal prices based on demand and competition.">
      <div className="space-y-5">
        <Toggle label="Enable pricing optimizer" checked={enabled} onChange={setEnabled} />
        <SegmentGroup label="Strategy" value={strategy} onChange={setStrategy} options={[{ value: 'competitive', label: 'Competitive' }, { value: 'value', label: 'Value-based' }, { value: 'cost-plus', label: 'Cost-plus' }]} disabled={!enabled} />
        <SegmentGroup label="Update frequency" value={frequency} onChange={setFrequency} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} disabled={!enabled} />
      </div>
    </Section>
  );
}

function InsightsSection() {
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [delivery, setDelivery] = useState<'email' | 'whatsapp' | 'in-app'>('email');
  return (
    <Section title="AI insights" description="Automated performance insights for your store.">
      <div className="space-y-5">
        <Toggle label="Enable AI insights" checked={enabled} onChange={setEnabled} />
        <SegmentGroup label="Frequency" value={frequency} onChange={setFrequency} disabled={!enabled} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
        <SegmentGroup label="Delivery" value={delivery} onChange={setDelivery} disabled={!enabled} options={[{ value: 'email', label: 'Email' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'in-app', label: 'In-app' }]} />
      </div>
    </Section>
  );
}

function DescriptionSection() {
  const [enabled, setEnabled] = useState(false);
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [tone, setTone] = useState<'professional' | 'casual' | 'persuasive'>('professional');
  return (
    <Section title="Product description generator" description="Auto-generate compelling product descriptions.">
      <div className="space-y-5">
        <Toggle label="Enable description generator" checked={enabled} onChange={setEnabled} />
        <SegmentGroup label="Length" value={length} onChange={setLength} disabled={!enabled} options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }]} />
        <SegmentGroup label="Tone" value={tone} onChange={setTone} disabled={!enabled} options={[{ value: 'professional', label: 'Professional' }, { value: 'casual', label: 'Casual' }, { value: 'persuasive', label: 'Persuasive' }]} />
      </div>
    </Section>
  );
}

function SegmentationSection() {
  const [enabled, setEnabled] = useState(true);
  const [criteria, setCriteria] = useState<'spend' | 'frequency' | 'product' | 'combined'>('combined');
  return (
    <Section title="AI customer segmentation" description="Group customers automatically by behaviour.">
      <div className="space-y-5">
        <Toggle label="Enable segmentation" checked={enabled} onChange={setEnabled} />
        <SegmentGroup label="Segmentation criteria" value={criteria} onChange={setCriteria} disabled={!enabled} options={[{ value: 'spend', label: 'Spend' }, { value: 'frequency', label: 'Frequency' }, { value: 'product', label: 'Product affinity' }, { value: 'combined', label: 'Combined' }]} />
      </div>
    </Section>
  );
}

function TestSection() {
  const test = useTestAi();
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState<string | undefined>();

  async function run() {
    if (!msg.trim()) return;
    const res = await test.mutateAsync(msg).catch((e: any) => { toast.error(e?.message ?? 'Test failed'); return null; });
    setResult(res?.reply ?? res?.suggestion ?? 'No reply generated');
  }

  return (
    <Section title="Test the AI" description="Try a sample message to preview the AI response.">
      <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. How much is delivery to Yaba?" />
      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" onClick={() => void run()} loading={test.isPending} disabled={!msg.trim()}>Test AI</Button>
        {result && <p className="text-sm text-slate-700 dark:text-slate-300">{result}</p>}
      </div>
    </Section>
  );
}
