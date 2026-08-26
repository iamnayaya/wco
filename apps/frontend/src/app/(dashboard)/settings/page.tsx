'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api/client';
import { Button, Card, Spinner } from '../../../components/ui';

interface NotificationPreferences {
  orderPaid: boolean;
  lowStockAlerts: boolean;
  dailySummary: boolean;
  weeklyReport: boolean;
  aiHandoffAlerts: boolean;
}

const LABELS: Record<keyof NotificationPreferences, string> = {
  orderPaid: 'Payment received',
  lowStockAlerts: 'Low stock warnings',
  dailySummary: 'Daily summary (evening)',
  weeklyReport: 'Weekly report (Mondays)',
  aiHandoffAlerts: 'AI needs my help (escalations)',
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const prefs = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api<NotificationPreferences>('/notifications/preferences'),
  });
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (prefs.data) setDraft(prefs.data);
  }, [prefs.data]);

  const save = useMutation({
    mutationFn: () => api('/notifications/preferences', { method: 'PUT', body: draft }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });

  if (prefs.isLoading || !draft) {
    return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-lg font-bold text-slate-900">Settings</h1>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sent to your WhatsApp and email — the channels you actually read.
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {(Object.keys(LABELS) as Array<keyof NotificationPreferences>).map((key) => (
            <li key={key} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-700">{LABELS[key]}</span>
              <button
                role="switch"
                aria-checked={draft[key]}
                onClick={() => setDraft({ ...draft, [key]: !draft[key] })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  draft[key] ? 'bg-emerald-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    draft[key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-3">
          <Button loading={save.isPending} disabled={save.isPending} onClick={() => save.mutate()}>
            Save preferences
          </Button>
          {save.isSuccess && !save.isPending && (
            <span className="text-xs font-medium text-emerald-600">Saved ✓</span>
          )}
          {save.error && <span className="text-xs font-medium text-red-600">{save.error.message}</span>}
        </div>
      </Card>
    </div>
  );
}
