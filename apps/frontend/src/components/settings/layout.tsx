'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User,
  MessageCircle,
  CreditCard,
  Truck,
  Bot,
  Bell,
  Users,
  BadgeCheck,
  Plug,
  Store,
  ChevronDown,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '../../lib/utils/format';

export type SettingsTab =
  | 'account'
  | 'whatsapp'
  | 'payment'
  | 'delivery'
  | 'ai'
  | 'notifications'
  | 'team'
  | 'subscription'
  | 'integrations'
  | 'business';

export const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; icon: typeof User; role?: 'owner' }> = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'business', label: 'Business', icon: Store },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'team', label: 'Team', icon: Users, role: 'owner' },
  { id: 'subscription', label: 'Subscription', icon: BadgeCheck, role: 'owner' },
  { id: 'integrations', label: 'Integrations', icon: Plug },
];

export function SettingsLayout({
  active,
  onSelect,
  isOwner,
  children,
  header,
}: {
  active: SettingsTab;
  onSelect: (tab: SettingsTab) => void;
  isOwner: boolean;
  children: ReactNode;
  header: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const tabs = SETTINGS_TABS.filter((t) => (t.role === 'owner' ? isOwner : true));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-6xl space-y-4">
      {header}

      {/* Mobile nav trigger */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setNavOpen((o) => !o)}
          aria-expanded={navOpen}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <span className="inline-flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-emerald-600" />
            {SETTINGS_TABS.find((t) => t.id === active)?.label}
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', navOpen && 'rotate-180')} />
        </button>
        <AnimatePresence>
          {navOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              aria-label="Settings sections (mobile)"
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                {tabs.map((tab) => (
                  <NavItem key={tab.id} tab={tab} active={active} onSelect={(id) => { onSelect(id); setNavOpen(false); }} />
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <nav aria-label="Settings sections" className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20 space-y-1 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
            {tabs.map((tab) => (
              <NavItem key={tab.id} tab={tab} active={active} onSelect={onSelect} />
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </motion.div>
  );
}

function NavItem({
  tab,
  active,
  onSelect,
}: {
  tab: (typeof SETTINGS_TABS)[number];
  active: SettingsTab;
  onSelect: (id: SettingsTab) => void;
}) {
  const isActive = active === tab.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-emerald-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
      )}
    >
      <tab.icon className="h-4 w-4 shrink-0" aria-hidden />
      {tab.label}
    </button>
  );
}
