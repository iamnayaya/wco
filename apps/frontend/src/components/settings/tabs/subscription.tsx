'use client';

import { useState } from 'react';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Field, Badge, Spinner } from '../../../components/ui';
import { Modal } from '../../../components/ui/modal';
import { Section } from '../primitives';
import { PLANS } from '../helpers';
import { useCancelSubscription, useMySubscription, useUpgradeSubscription } from '../hooks';
import { cn } from '../../../lib/utils/format';

export function SubscriptionTab() {
  return (
    <div className="space-y-6">
      <CurrentPlanSection />
      <AvailablePlansSection />
      <BillingInfoSection />
      <InvoicesSection />
      <UsageSection />
    </div>
  );
}

function CurrentPlanSection() {
  const { data, isLoading } = useMySubscription();
  const cancel = useCancelSubscription();
  const [open, setOpen] = useState(false);

  const plan = PLANS.find((p) => p.code === data?.planCode) ?? PLANS[0];

  if (isLoading) return <Section title="Current plan"><div className="flex justify-center py-6"><Spinner /></div></Section>;

  return (
    <Section title="Current plan" description="Your subscription and renewal details.">
      <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{plan.name} plan</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">{plan.price}{plan.period}</p>
            {data?.renewsAt && <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">Renews {new Date(data.renewsAt).toLocaleDateString()}</p>}
          </div>
          <Button variant="danger" onClick={() => setOpen(true)} loading={cancel.isPending}>Cancel subscription</Button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Cancel subscription?">
        <p className="text-sm text-slate-600">Your plan will stay active until the end of the current billing period, then downgrade to Free.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Keep plan</Button>
          <Button variant="danger" onClick={() => cancel.mutate({ reason: 'User requested' }, { onSuccess: () => { setOpen(false); toast.success('Cancellation scheduled'); } })}>Cancel subscription</Button>
        </div>
      </Modal>
    </Section>
  );
}

function AvailablePlansSection() {
  const upgrade = useUpgradeSubscription();
  const { data: current } = useMySubscription();
  const currentCode = current?.planCode ?? 'FREE';

  return (
    <Section title="Available plans" description="Choose the plan that fits your business.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const isCurrent = p.code === currentCode;
          return (
            <div key={p.code} className={cn('flex flex-col rounded-xl border p-4', p.popular ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700')}>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                {p.popular && <Badge label="Popular" tone="NEW" />}
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{p.price}<span className="text-sm font-normal text-slate-500">{p.period}</span></p>
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {p.features.map((f) => <li key={f} className="flex gap-1.5"><span className="text-emerald-500">✓</span>{f}</li>)}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <Badge label="Current plan" tone="PAID" />
                ) : (
                  <Button variant={p.popular ? 'primary' : 'secondary'} className="w-full" loading={upgrade.isPending && upgrade.variables?.planCode === p.code}
                    onClick={() => upgrade.mutate({ planCode: p.code }, { onSuccess: () => toast.success(`Upgraded to ${p.name}`) })}>
                    {p.code === 'FREE' ? 'Downgrade' : 'Select plan'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function BillingInfoSection() {
  const [billingEmail, setBillingEmail] = useState('billing@example.com');
  const [address, setAddress] = useState('Yaba, Lagos, Nigeria');
  const [card, setCard] = useState('Visa •••• 4242');

  return (
    <Section title="Billing information">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Billing email"><Input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} /></Field>
        <Field label="Billing address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <Field label="Payment method"><Input value={card} onChange={(e) => setCard(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={() => toast.success('Billing info saved')}>Save billing info</Button></div>
    </Section>
  );
}

function InvoicesSection() {
  const invoices = [
    { id: 'INV-0091', date: '2026-08-01', amount: '₦25,000', status: 'PAID' },
    { id: 'INV-0087', date: '2026-07-01', amount: '₦25,000', status: 'PAID' },
    { id: 'INV-0083', date: '2026-06-01', amount: '₦7,500', status: 'PAID' },
  ];
  return (
    <Section title="Invoices">
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
                <td className="py-2.5 pr-4"><Badge label={inv.status} tone="PAID" /></td>
                <td className="py-2.5 text-right"><Button variant="ghost" onClick={() => toast('Invoice downloaded')}>Download</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function UsageSection() {
  const stats = [
    { label: 'Messages (AI replies)', used: 4210, limit: 5000 },
    { label: 'Products', used: 328, limit: 1000 },
    { label: 'Customers', used: 1502, limit: 5000 },
  ];
  return (
    <Section title="Usage" description="How much of your plan you've used this period.">
      <div className="space-y-4">
        {stats.map((s) => {
          const pct = Math.min(100, Math.round((s.used / s.limit) * 100));
          return (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{s.label}</span>
                <span className="tabular-nums text-slate-500">{s.used.toLocaleString()} / {s.limit.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={cn('h-full rounded-full', pct > 90 ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
