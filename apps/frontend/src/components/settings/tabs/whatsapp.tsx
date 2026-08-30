'use client';

import { useState } from 'react';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Field, Textarea, Badge, Spinner, EmptyState } from '../../../components/ui';
import { Modal } from '../../../components/ui/modal';
import { Section, Toggle, SegmentGroup, RangeSlider } from '../primitives';
import { AI_LANGUAGES, TONES, waConnectSchema } from '../helpers';
import { useAiConfig, useConnectWhatsApp, useDisconnectWhatsApp, useUpdateAiConfig, useVerifyWhatsApp, useWhatsAppConnection, useTestAi } from '../hooks';

export function WhatsAppTab() {
  return (
    <div className="space-y-6">
      <ConnectionSection />
      <AiAutoResponderSection />
      <MessageTemplatesSection />
      <BusinessHoursSection />
    </div>
  );
}

// ─── Connection ──────────────────────────────────────────────────

function ConnectionSection() {
  const conn = useWhatsAppConnection();
  const connect = useConnectWhatsApp();
  const verify = useVerifyWhatsApp();
  const disconnect = useDisconnectWhatsApp();

  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');

  const connected = Boolean(conn.data?.phone) && conn.data?.status !== 'DISCONNECTED';

  async function submitConnect(e: React.FormEvent) {
    e.preventDefault();
    const parsed = waConnectSchema.safeParse({ phone, displayName });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Invalid details'); return; }
    try {
      await connect.mutateAsync(parsed.data);
      setOpen(false);
      setPhone('');
      toast.success('WhatsApp number connected');
    } catch (err: any) { toast.error(err?.message ?? 'Could not connect'); }
  }

  return (
    <Section
      title="WhatsApp connection"
      description="Connect and verify the WhatsApp number you use for business."
      action={connected ? <Badge label={conn.data?.verified ? 'Verified' : 'Pending'} tone={conn.data?.verified ? 'DELIVERED' : 'PROCESSING'} /> : undefined}
    >
      {conn.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : connected ? (
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{conn.data?.phone}</p>
            {conn.data?.displayName && <p className="text-sm text-slate-500">{conn.data.displayName}</p>}
            {!conn.data?.verified && (
              <p className="mt-2 text-xs text-amber-600">Complete business verification to unlock the full API.</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {!conn.data?.verified && (
              <Button variant="secondary" onClick={() => verify.mutate({ phoneNumberId: conn.data?.phoneNumberId ?? '' }, { onSuccess: () => toast.success('Verified') })}>
                Verify
              </Button>
            )}
            <Button variant="danger" onClick={() => disconnect.mutate(undefined, { onSuccess: () => toast.success('Disconnected') })} loading={disconnect.isPending}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          {conn.data?.qrCode && (
            <img src={conn.data.qrCode} alt="WhatsApp connection QR code" className="h-44 w-44 rounded-lg border border-slate-200" />
          )}
          <Button onClick={() => setOpen(true)}>Connect WhatsApp number</Button>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Connect WhatsApp">
        <form onSubmit={submitConnect} className="space-y-4">
          <Field label="Business WhatsApp number">
            <Input type="tel" placeholder="+2348012345678" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Field>
          <Field label="Display name (optional)">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={connect.isPending}>Connect</Button>
          </div>
        </form>
      </Modal>
    </Section>
  );
}

// ─── AI auto-responder ───────────────────────────────────────────

function AiAutoResponderSection() {
  const { data, isLoading } = useAiConfig();
  const update = useUpdateAiConfig();
  const test = useTestAi();
  const [testMsg, setTestMsg] = useState('');
  const [result, setResult] = useState<string | undefined>();

  const cfg = data ?? {};

  function set<K extends keyof NonNullable<typeof data>>(key: K, value: NonNullable<typeof data>[K]) {
    update.mutate({ [key]: value }, { onSuccess: () => toast.success('AI settings saved') });
  }
  async function runTest() {
    if (!testMsg.trim()) return;
    const res = await test.mutateAsync(testMsg).catch((e: any) => { toast.error(e?.message ?? 'Test failed'); return null; });
    setResult(res?.reply ?? res?.suggestion ?? 'No response');
  }

  if (isLoading) return <Section title="AI auto-responder"><div className="flex justify-center py-6"><Spinner /></div></Section>;

  return (
    <Section title="AI auto-responder" description="Control how the AI answers your WhatsApp messages.">
      <div className="space-y-5">
        <Toggle label="Enable AI auto-responder" description="Automatically reply to customer messages." checked={Boolean(cfg.isEnabled)} disabled={update.isPending} onChange={(v) => { set('isEnabled', v); set('autoReplyEnabled', v); }} />
        <Toggle label="Auto-send replies" description="Send responses without manual approval." checked={Boolean(cfg.autoReplyEnabled)} disabled={update.isPending} onChange={(v) => set('autoReplyEnabled', v)} />

        <SegmentGroup label="Response tone" value={cfg.tone ?? 'FRIENDLY'} onChange={(v) => set('tone', v)} options={TONES} disabled={update.isPending} />
        <MultiSelect label="Response languages" value={cfg.languages ?? ['en']} onChange={(v) => set('languages', v)} options={AI_LANGUAGES} />
        <RangeSlider label="Confidence threshold" value={cfg.confidenceThreshold ?? 0.7} min={0.1} max={1} suffix="%" onChange={(v) => set('confidenceThreshold', Number(v.toFixed(2)))} disabled={update.isPending} />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Escalation keywords (comma separated)</label>
          <Input
            value={(cfg.escalationKeywords ?? []).join(', ')}
            onChange={(e) => set('escalationKeywords', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="refund, complaint, cancel, human"
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <label className="mb-2 block text-sm font-medium text-slate-700">Test the AI</label>
          <Textarea rows={2} value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="e.g. How much is your size 42 sneaker?" />
          <div className="mt-2 flex items-center gap-3">
            <Button variant="secondary" onClick={() => void runTest()} loading={test.isPending} disabled={!testMsg.trim()}>Test AI</Button>
            {result && <p className="text-sm text-slate-600 dark:text-slate-300">{result}</p>}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Message templates (client-managed) ──────────────────────────

interface Template { id: string; name: string; body: string }

function MessageTemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([
    { id: 'welcome', name: 'Welcome', body: 'Hello {{customerName}}! Thanks for reaching out to {{businessName}}. How can we help you today?' },
    { id: 'order-confirm', name: 'Order confirmation', body: 'Hi {{customerName}}, your order #{{orderNumber}} has been confirmed. We will notify you once it ships.' },
  ]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  function addTemplate() {
    if (!name.trim() || !body.trim()) return;
    setTemplates((t) => [...t, { id: crypto.randomUUID(), name, body }]);
    setName(''); setBody(''); setOpen(false);
    toast.success('Template created');
  }

  return (
    <Section
      title="Message templates"
      description="Reusable WhatsApp templates for common replies."
      action={<Button variant="secondary" onClick={() => setOpen(true)}>Create template</Button>}
    >
      <ul className="space-y-3">
        {templates.map((t) => (
          <li key={t.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</p>
              <button type="button" className="text-xs font-medium text-red-500 hover:underline" onClick={() => { setTemplates((x) => x.filter((y) => y.id !== t.id)); toast.success('Template deleted'); }}>
                Delete
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t.body}</p>
          </li>
        ))}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title="Create template">
        <div className="space-y-4">
          <Field label="Template name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Content"><Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Supports {{customerName}}, {{orderNumber}}, {{businessName}}" /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={addTemplate} disabled={!name.trim() || !body.trim()}>Save template</Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

// ─── Business hours ──────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function BusinessHoursSection() {
  const { data } = useAiConfig();
  const update = useUpdateAiConfig();
  const [start, setStart] = useState(data?.workingHours?.start ?? '09:00');
  const [end, setEnd] = useState(data?.workingHours?.end ?? '17:00');
  const [days, setDays] = useState<number[]>(data?.workingHours?.days ?? [0, 1, 2, 3, 4]);
  const [afterHours, setAfterHours] = useState(data?.outOfOfficeBody ?? '');

  function save(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      { workingHours: { start, end, days }, outOfOfficeBody: afterHours },
      { onSuccess: () => toast.success('Business hours saved') },
    );
  }

  async function toggleDay(i: number) {
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()));
  }

  return (
    <Section title="Business hours" description="Let customers know when you're available and set an after-hours message.">
      <form onSubmit={save} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={days.includes(i)} onClick={() => void toggleDay(i)}
              className={days.includes(i) ? 'rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white' : 'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600'}>
              {d}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Open time"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Close time"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <Field label="After-hours message"><Textarea rows={2} value={afterHours} onChange={(e) => setAfterHours(e.target.value)} placeholder="Thanks for messaging! We'll get back to you during business hours." /></Field>
        <div className="flex justify-end"><Button type="submit" loading={update.isPending}>Save business hours</Button></div>
      </form>
    </Section>
  );
}

// ─── Multi-select helper ─────────────────────────────────────────

function MultiSelect({ label, value, onChange, options }: { label: string; value: string[]; onChange: (v: string[]) => void; options: Array<{ value: string; label: string }> }) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value.includes(o.value)} onClick={() => toggle(o.value)}
            className={value.includes(o.value) ? 'rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white' : 'rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600'}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
