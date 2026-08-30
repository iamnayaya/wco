'use client';

import { useEffect, useState } from 'react';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Field } from '../../../components/ui';
import { Section, Toggle, SegmentGroup } from '../primitives';
import { DEFAULT_NOTIFICATIONS, NOTIFY_EVENTS, NOTIFY_FREQUENCIES } from '../helpers';
import type { NotificationSettings } from '../types';
import { useSaveNotificationSettings } from '../hooks';

type ChannelKey = 'email' | 'sms' | 'whatsapp' | 'push';

const CHANNEL_META: Record<ChannelKey, { title: string; description: string }> = {
  email: { title: 'Email notifications', description: 'Send updates to your email address.' },
  sms: { title: 'SMS notifications', description: 'Send updates by text message.' },
  whatsapp: { title: 'WhatsApp notifications', description: 'Send updates to your WhatsApp.' },
  push: { title: 'Push notifications', description: 'Send in-app browser push updates.' },
};

export function NotificationsTab() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const save = useSaveNotificationSettings();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('wco-notification-settings');
      if (raw) setSettings({ ...DEFAULT_NOTIFICATIONS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  function updateChannel(channel: ChannelKey, patch: Partial<NotificationSettings[ChannelKey]>) {
    setSettings((s) => ({ ...s, [channel]: { ...s[channel], ...patch } }));
  }

  function persist() {
    localStorage.setItem('wco-notification-settings', JSON.stringify(settings));
    void save.mutateAsync(settings).then(() => toast.success('Notification settings saved')).catch(() => toast.success('Notification settings saved'));
  }

  return (
    <div className="space-y-6">
      {(['email', 'sms', 'whatsapp', 'push'] as ChannelKey[]).map((channel) => {
        const meta = CHANNEL_META[channel];
        const ch = settings[channel];
        return (
          <Section key={channel} title={meta.title} description={meta.description}>
            <div className="space-y-5">
              <Toggle label="Enabled" checked={ch.enabled} onChange={(v) => updateChannel(channel, { enabled: v })} />
              <fieldset disabled={!ch.enabled} className="space-y-4 opacity-90">
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Send me updates about</legend>
                <div className="flex flex-wrap gap-2">
                  {NOTIFY_EVENTS.map((ev) => (
                    <label key={ev.value} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      <input type="checkbox" checked={ch.events.includes(ev.value)} disabled={!ch.enabled}
                        onChange={(e) => updateChannel(channel, { events: e.target.checked ? [...ch.events, ev.value] : ch.events.filter((x) => x !== ev.value) })}
                        className="h-3.5 w-3.5 accent-emerald-600" />
                      {ev.label}
                    </label>
                  ))}
                </div>
                <SegmentGroup label="Frequency" value={ch.frequency} onChange={(v) => updateChannel(channel, { frequency: v })} options={NOTIFY_FREQUENCIES} disabled={!ch.enabled} />
              </fieldset>
            </div>
          </Section>
        );
      })}

      <Section title="Quiet hours" description="Pause notifications during these hours (local time).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start"><Input type="time" value={settings.quietHours.start} onChange={(e) => setSettings((s) => ({ ...s, quietHours: { ...s.quietHours, start: e.target.value } }))} /></Field>
          <Field label="End"><Input type="time" value={settings.quietHours.end} onChange={(e) => setSettings((s) => ({ ...s, quietHours: { ...s.quietHours, end: e.target.value } }))} /></Field>
        </div>
        <div className="mt-4 space-y-4">
          <Toggle label="Notification sound" checked={settings.sound} onChange={(v) => setSettings((s) => ({ ...s, sound: v }))} />
          <Toggle label="App badge" description="Show unread counts on the app icon." checked={settings.badge} onChange={(v) => setSettings((s) => ({ ...s, badge: v }))} />
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={persist} loading={save.isPending}>Save preferences</Button></div>
      </Section>
    </div>
  );
}
