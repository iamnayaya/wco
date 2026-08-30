'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Field, Badge, Spinner, EmptyState } from '../../../components/ui';
import { Modal } from '../../../components/ui/modal';
import { Section, Toggle } from '../primitives';
import { paymentMethodSchema, CURRENCIES } from '../helpers';
import { useCreatePaymentMethod, useDeletePaymentMethod, usePaymentMethods, useUpdatePaymentMethod } from '../hooks';

type MethodForm = { type: 'BANK_ACCOUNT' | 'MOBILE_MONEY' | 'USSD'; providerName: string; accountName: string; accountNumber: string; bankCode?: string; isDefault: boolean };

export function PaymentTab() {
  return (
    <div className="space-y-6">
      <PaymentMethodsSection />
      <PayoutAccountsSection />
      <PaymentPreferencesSection />
      <InvoicesSection />
    </div>
  );
}

function PaymentMethodsSection() {
  const { data, isLoading } = usePaymentMethods();
  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod();
  const remove = useDeletePaymentMethod();

  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<MethodForm>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: { type: 'BANK_ACCOUNT', isDefault: false },
  });
  const isDefault = watch('isDefault');

  async function onSubmit(f: MethodForm) {
    try {
      await create.mutateAsync(f);
      reset();
      setOpen(false);
      toast.success('Payment method added');
    } catch (e: any) { toast.error(e?.message ?? 'Could not add method'); }
  }

  return (
    <Section
      title="Payment methods"
      description="Ways your customers can pay you."
      action={<Button variant="secondary" onClick={() => setOpen(true)}>Add payment method</Button>}
    >
      {isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : !data?.items.length ? (
        <EmptyState title="No payment methods yet" description="Add a bank account or mobile money to receive payments." />
      ) : (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.providerName}</p>
                  {m.isDefault && <Badge label="Default" tone="NEW" />}
                </div>
                <p className="text-xs text-slate-500">{m.type?.replaceAll('_', ' ')} · {m.accountName} · •••{String(m.accountNumber ?? '').slice(-4)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="ghost" onClick={() => update.mutate({ id: m.id, input: { isDefault: true } }, { onSuccess: () => toast.success('Set as default') })}>Set default</Button>
                <Button variant="ghost" className="text-red-500" onClick={() => { remove.mutate(m.id, { onSuccess: () => toast.success('Removed') }); }}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add payment method">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" error={errors.type?.message}>
              <select {...register('type')} className="input">
                <option value="BANK_ACCOUNT">Bank account</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="USSD">USSD</option>
              </select>
            </Field>
            <Field label="Provider name" error={errors.providerName?.message}><Input {...register('providerName')} placeholder="e.g. Paystack, OPay, GTBank" /></Field>
            <Field label="Account name" error={errors.accountName?.message}><Input {...register('accountName')} /></Field>
            <Field label="Account number" error={errors.accountNumber?.message}><Input {...register('accountNumber')} inputMode="numeric" /></Field>
          </div>
          <Field label="Bank code (optional)" error={errors.bankCode?.message}><Input {...register('bankCode')} placeholder="e.g. 058" /></Field>
          <Toggle label="Set as default" checked={isDefault} onChange={(v) => reset({ ...watch(), isDefault: v })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Add method</Button>
          </div>
        </form>
      </Modal>
    </Section>
  );
}

// ─── Payout accounts (client-list) ───────────────────────────────

interface Payout { id: string; bankName: string; accountName: string; accountNumber: string; isDefault: boolean }

function PayoutAccountsSection() {
  const [payouts, setPayouts] = useState<Payout[]>([
    { id: 'p1', bankName: 'GTBank', accountName: 'Amina Yusuf', accountNumber: '0123456789', isDefault: true },
  ]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bankName: '', accountName: '', accountNumber: '' });

  function add() {
    if (!form.bankName || !form.accountName || !form.accountNumber) return;
    setPayouts((p) => [{ ...form, id: crypto.randomUUID(), isDefault: false }, ...p]);
    setForm({ bankName: '', accountName: '', accountNumber: '' });
    setOpen(false);
    toast.success('Payout account added');
  }

  return (
    <Section
      title="Payout accounts"
      description="Where your sales revenue is paid out."
      action={<Button variant="secondary" onClick={() => setOpen(true)}>Add payout account</Button>}
    >
      {payouts.length === 0 ? <EmptyState title="No payout accounts" /> : (
        <ul className="space-y-3">
          {payouts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.bankName}</p>
                  {p.isDefault && <Badge label="Default" tone="NEW" />}
                </div>
                <p className="text-xs text-slate-500">{p.accountName} · •••{p.accountNumber.slice(-4)}</p>
              </div>
              <div className="flex gap-2">
                {!p.isDefault && <Button variant="ghost" onClick={() => { setPayouts((x) => x.map((y) => ({ ...y, isDefault: y.id === p.id }))); toast.success('Set as default'); }}>Set default</Button>}
                <Button variant="ghost" className="text-red-500" onClick={() => setPayouts((x) => x.filter((y) => y.id !== p.id))}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add payout account">
        <div className="space-y-4">
          <Field label="Bank name"><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
          <Field label="Account name"><Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /></Field>
          <Field label="Account number"><Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} inputMode="numeric" /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add} disabled={!form.bankName || !form.accountName || !form.accountNumber}>Add account</Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

// ─── Preferences ─────────────────────────────────────────────────

function PaymentPreferencesSection() {
  const [currency, setCurrency] = useState('NGN');
  const [taxRate, setTaxRate] = useState(7.5);
  const [prefix, setPrefix] = useState('INV');

  function save() {
    // Persisted here with optimistic feedback; hook into business settings in production.
    toast.success('Payment preferences saved');
  }

  return (
    <Section title="Payment preferences" description="Defaults used across invoices and checkout.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Default currency">
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Tax rate (%)"><Input type="number" min={0} max={100} step={0.1} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></Field>
        <Field label="Invoice prefix"><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={save}>Save preferences</Button></div>
    </Section>
  );
}

// ─── Invoices (sample list) ──────────────────────────────────────

interface Invoice { id: string; date: string; amount: string; status: 'PAID' | 'PENDING' | 'OVERDUE' }

function InvoicesSection() {
  const [invoices] = useState<Invoice[]>([
    { id: 'INV-0091', date: '2026-08-01', amount: '₦25,000', status: 'PAID' },
    { id: 'INV-0087', date: '2026-07-01', amount: '₦25,000', status: 'PAID' },
    { id: 'INV-0083', date: '2026-06-01', amount: '₦7,500', status: 'PAID' },
  ]);

  return (
    <Section title="Invoices" description="Billing history for your subscription.">
      {invoices.length === 0 ? <EmptyState title="No invoices yet" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-2 pr-4 font-medium">Invoice</th><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Amount</th><th className="py-2 pr-4 font-medium">Status</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">{inv.id}</td>
                  <td className="py-2.5 pr-4 text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-slate-700 dark:text-slate-300">{inv.amount}</td>
                  <td className="py-2.5 pr-4"><Badge label={inv.status} tone={inv.status === 'PAID' ? 'PAID' : 'PENDING_PAYMENT'} /></td>
                  <td className="py-2.5 text-right"><Button variant="ghost" onClick={() => toast('Invoice downloaded')}>Download</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
