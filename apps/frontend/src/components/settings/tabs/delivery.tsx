'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Field, Spinner, EmptyState, Badge } from '../../../components/ui';
import { Modal } from '../../../components/ui/modal';
import { Section, Toggle } from '../primitives';
import { providerLinkSchema } from '../helpers';
import { useDeliveryProviders, useLinkDeliveryProvider, useUpdateDeliveryProvider } from '../hooks';

type ProviderForm = { providerCode: 'GIG' | 'KWIK' | 'SENDY'; accountRef?: string; credentials: string; isDefault: boolean };

export function DeliveryTab() {
  return (
    <div className="space-y-6">
      <ProvidersSection />
      <RatesSection />
      <ZonesSection />
      <PreferencesSection />
    </div>
  );
}

function ProvidersSection() {
  const { data, isLoading } = useDeliveryProviders();
  const link = useLinkDeliveryProvider();
  const update = useUpdateDeliveryProvider();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ProviderForm>({
    resolver: zodResolver(providerLinkSchema),
    defaultValues: { providerCode: 'GIG', isDefault: false },
  });
  const isDefault = watch('isDefault');

  async function onSubmit(f: ProviderForm) {
    try {
      await link.mutateAsync(f);
      reset();
      setOpen(false);
      toast.success('Delivery provider connected');
    } catch (e: any) { toast.error(e?.message ?? 'Could not connect provider'); }
  }

  return (
    <Section
      title="Delivery providers"
      description="Couriers you use to fulfil orders."
      action={<Button variant="secondary" onClick={() => setOpen(true)}>Connect provider</Button>}
    >
      {isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : !data?.items.length ? (
        <EmptyState title="No delivery providers" description="Connect GIG, Kwik or Sendy to offer delivery." />
      ) : (
        <ul className="space-y-3">
          {data.items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.providerCode}</p>
                  {p.isDefault && <Badge label="Default" tone="NEW" />}
                  <Badge label={p.isActive === false ? 'Disabled' : 'Active'} tone={p.isActive === false ? 'CANCELLED' : 'PAID'} />
                </div>
                <p className="text-xs text-slate-500">{p.accountRef ?? 'Connected'}</p>
              </div>
              <div className="flex gap-2">
                {!p.isDefault && <Button variant="ghost" onClick={() => update.mutate({ id: p.id, input: { isDefault: true } }, { onSuccess: () => toast.success('Set as default') })}>Set default</Button>}
                <Toggle label="" checked={p.isActive !== false} onChange={(v) => update.mutate({ id: p.id, input: { isActive: v } }, { onSuccess: () => toast.success('Updated') })} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Connect delivery provider">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Provider" error={errors.providerCode?.message}>
            <select {...register('providerCode')} className="input">
              <option value="GIG">GIG Logistics</option>
              <option value="KWIK">KWIK</option>
              <option value="SENDY">Sendy</option>
            </select>
          </Field>
          <Field label="Account reference (optional)" error={errors.accountRef?.message}><Input {...register('accountRef')} /></Field>
          <Field label="API credentials" error={errors.credentials?.message}><Input {...register('credentials')} type="password" placeholder="API key / secret" /></Field>
          <Toggle label="Set as default" checked={isDefault} onChange={(v) => reset({ ...watch(), isDefault: v })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={link.isPending}>Connect</Button>
          </div>
        </form>
      </Modal>
    </Section>
  );
}

// ─── Rates ───────────────────────────────────────────────────────

interface Rate { id: string; zone: string; rate: string; freeAbove: string }

function RatesSection() {
  const [rates, setRates] = useState<Rate[]>([{ id: 'r1', zone: 'Lagos Mainland', rate: '₦1,500', freeAbove: '₦50,000' }]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ zone: '', rate: '', freeAbove: '' });

  function add() {
    if (!form.zone || !form.rate) return;
    setRates((r) => [...r, { id: crypto.randomUUID(), ...form }]);
    setForm({ zone: '', rate: '', freeAbove: '' });
    setOpen(false);
    toast.success('Delivery rate added');
  }

  return (
    <Section title="Delivery rates" description="Charges applied per delivery zone." action={<Button variant="secondary" onClick={() => setOpen(true)}>Add rate</Button>}>
      {rates.length === 0 ? <EmptyState title="No rates" /> : (
        <ul className="space-y-2">
          {rates.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{r.zone}</p>
                {r.freeAbove && <p className="text-xs text-slate-500">Free above {r.freeAbove}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-700 dark:text-slate-300">{r.rate}</span>
                <Button variant="ghost" className="text-red-500" onClick={() => setRates((x) => x.filter((y) => y.id !== r.id))}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add delivery rate">
        <div className="space-y-4">
          <Field label="Zone"><Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></Field>
          <Field label="Rate (₦)"><Input value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
          <Field label="Free shipping threshold (₦, optional)"><Input value={form.freeAbove} onChange={(e) => setForm({ ...form, freeAbove: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add} disabled={!form.zone || !form.rate}>Save rate</Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

// ─── Zones ───────────────────────────────────────────────────────

interface Zone { id: string; name: string; areas: string }

function ZonesSection() {
  const [zones, setZones] = useState<Zone[]>([{ id: 'z1', name: 'Lagos Mainland', areas: 'Yaba, Surulere, Ikeja, Gbagada' }, { id: 'z2', name: 'Lagos Island', areas: 'Victoria Island, Lekki, Ikoyi' }]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', areas: '' });

  function add() {
    if (!form.name || !form.areas) return;
    setZones((z) => [...z, { id: crypto.randomUUID(), ...form }]);
    setForm({ name: '', areas: '' });
    setOpen(false);
    toast.success('Zone added');
  }

  return (
    <Section title="Delivery zones" description="Grouped areas you deliver to." action={<Button variant="secondary" onClick={() => setOpen(true)}>Add zone</Button>}>
      {zones.length === 0 ? <EmptyState title="No zones" /> : (
        <ul className="space-y-2">
          {zones.map((z) => (
            <li key={z.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{z.name}</p>
                <p className="text-xs text-slate-500">{z.areas}</p>
              </div>
              <Button variant="ghost" className="text-red-500" onClick={() => setZones((x) => x.filter((y) => y.id !== z.id))}>Delete</Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add delivery zone">
        <div className="space-y-4">
          <Field label="Zone name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Areas (comma separated)"><Input value={form.areas} onChange={(e) => setForm({ ...form, areas: e.target.value })} placeholder="Yaba, Surulere, Ikeja" /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add} disabled={!form.name || !form.areas}>Save zone</Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

// ─── Preferences ─────────────────────────────────────────────────

function PreferencesSection() {
  const [autoAssign, setAutoAssign] = useState(true);
  const [notify, setNotify] = useState(true);

  function save() {
    toast.success('Delivery preferences saved');
  }

  return (
    <Section title="Delivery preferences">
      <div className="space-y-4">
        <Toggle label="Auto-assign delivery provider" description="Pick the cheapest available courier automatically." checked={autoAssign} onChange={setAutoAssign} />
        <Toggle label="Delivery notifications" description="Notify customers of delivery status updates." checked={notify} onChange={setNotify} />
        <div className="flex justify-end"><Button onClick={save}>Save preferences</Button></div>
      </div>
    </Section>
  );
}
