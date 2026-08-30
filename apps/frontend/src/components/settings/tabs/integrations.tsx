'use client';

import { useState } from 'react';
import { toast } from '../../../lib/hooks/use-toast';
import { Button } from '../../../components/ui';
import { Toggle } from '../primitives';

const INTEGRATIONS = [
  { id: 'shopify', name: 'Shopify', description: 'Sync products and orders with your Shopify store.', connected: true, tone: true },
  { id: 'meta', name: 'Meta / Instagram', description: 'Sell through Instagram and Facebook shops.', connected: true, tone: true },
  { id: 'quickbooks', name: 'QuickBooks', description: 'Sync invoices and accounting with QuickBooks.', connected: false, tone: false },
  { id: 'zapier', name: 'Zapier', description: 'Automate workflows with 5,000+ apps.', connected: false, tone: false },
  { id: 'google', name: 'Google Analytics', description: 'Track store traffic and conversions.', connected: false, tone: false },
];

export function IntegrationsTab() {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(INTEGRATIONS.map((i) => [i.id, i.connected]))
  );

  function toggle(id: string) {
    setState((s) => {
      const next = { ...s, [id]: !s[id] };
      toast.success(next[id] ? 'Integration connected' : 'Integration disconnected');
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Connected integrations</h2>
        <p className="text-sm text-slate-500">Manage the external tools connected to your store.</p>
      </div>

      {INTEGRATIONS.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white">{i.name}</p>
            <p className="text-sm text-slate-500">{i.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {state[i.id] && <Button variant="ghost" onClick={() => toast('Configuration opened')}>Configure</Button>}
            <Toggle label="" checked={state[i.id]} onChange={() => toggle(i.id)} />
          </div>
        </div>
      ))}
    </div>
  );
}
